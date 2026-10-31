import SwiftUI

/// Notch outline: flush with the top edge, small outward flares at the top
/// corners like the hardware notch, rounded bottom corners. Radii animate.
struct NotchShape: Shape {
    var topRadius: CGFloat
    var bottomRadius: CGFloat

    var animatableData: AnimatablePair<CGFloat, CGFloat> {
        get { .init(topRadius, bottomRadius) }
        set { topRadius = newValue.first; bottomRadius = newValue.second }
    }

    func path(in r: CGRect) -> Path {
        let t = topRadius, b = min(bottomRadius, (r.height - t) / 2, (r.width - 2 * t) / 2)
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addQuadCurve(to: CGPoint(x: r.minX + t, y: r.minY + t), control: CGPoint(x: r.minX + t, y: r.minY))
        p.addLine(to: CGPoint(x: r.minX + t, y: r.maxY - b))
        p.addQuadCurve(to: CGPoint(x: r.minX + t + b, y: r.maxY), control: CGPoint(x: r.minX + t, y: r.maxY))
        p.addLine(to: CGPoint(x: r.maxX - t - b, y: r.maxY))
        p.addQuadCurve(to: CGPoint(x: r.maxX - t, y: r.maxY - b), control: CGPoint(x: r.maxX - t, y: r.maxY))
        p.addLine(to: CGPoint(x: r.maxX - t, y: r.minY + t))
        p.addQuadCurve(to: CGPoint(x: r.maxX, y: r.minY), control: CGPoint(x: r.maxX - t, y: r.minY))
        p.closeSubpath()
        return p
    }
}

/// Content dissolves in place through a blur while the black shape morphs
/// around it; nothing inside is re-laid-out frame by frame.
private struct Dissolve: ViewModifier {
    let amount: CGFloat
    func body(content: Content) -> some View {
        content
            .blur(radius: 10 * amount)
            .opacity(1 - amount)
            .scaleEffect(1 - 0.04 * amount, anchor: .top)
    }
}

extension AnyTransition {
    static var dissolve: AnyTransition {
        .asymmetric(
            insertion: .modifier(active: Dissolve(amount: 1), identity: Dissolve(amount: 0))
                .animation(.easeOut(duration: 0.3).delay(0.06)),
            // Leave quickly so it's gone before the shape closes over it.
            removal: .modifier(active: Dissolve(amount: 1), identity: Dissolve(amount: 0))
                .animation(.easeIn(duration: 0.14)))
    }
}

struct NotchRootView: View {
    @ObservedObject var model: NotchModel
    @ObservedObject var player: NowPlaying
    @ObservedObject var inkwell: InkwellLink
    @Namespace private var hero
    @Namespace private var tabs

    private var notchH: CGFloat { model.notchSize.height }
    /// Artwork + equalizer live once and fly between the closed wings, the
    /// notifications' wings and the open player.
    private var showsHero: Bool {
        model.showsLiveActivity || model.showsMusicWings || (model.mode == .expanded && model.tab == .music && player.hasTrack)
    }

    private var radii: (top: CGFloat, bottom: CGFloat) {
        model.mode == .closed ? (6, model.peeking ? 15 : 12) : (14, 30)
    }

    var body: some View {
        let size = model.currentSize
        let shape = NotchShape(topRadius: radii.top, bottomRadius: radii.bottom)
        return ZStack(alignment: .top) {
            content
            if showsHero { heroArtwork; heroEqualizer }
        }
        .frame(width: size.width, height: size.height, alignment: .top)
        .background(Color.black)
        .clipShape(shape)
        .shadow(color: .black.opacity(model.isOpen ? 0.45 : 0), radius: 14, y: 6)
        .onDrop(of: [.fileURL], delegate: NotchDrop(model: model))
        .animation(NotchModel.open, value: model.showsLiveActivity)
        .animation(NotchModel.open, value: model.showsFocus)
        .animation(NotchModel.open, value: model.showsActivity)
        .animation(NotchModel.open, value: player.artWide)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .environment(\.colorScheme, .dark)
    }

    private var heroArtwork: some View {
        let open = model.mode == .expanded
        return Artwork(image: player.artwork, fallback: player.appIcon, radius: open ? 14 : 5)
            .overlay(alignment: .bottomTrailing) {
                if open, let icon = player.appIcon, player.artwork != nil {
                    Image(nsImage: icon).resizable().frame(width: 22, height: 22).offset(x: 6, y: 6)
                        .transition(.dissolve)
                }
            }
            .matchedGeometryEffect(id: "art", in: hero, properties: .frame, isSource: false)
            .allowsHitTesting(false)
            .transition(.dissolve)
    }

    private var heroEqualizer: some View {
        Equalizer(color: player.accent, playing: player.isPlaying)
            .matchedGeometryEffect(id: "eq", in: hero, properties: .frame, isSource: false)
            .allowsHitTesting(false)
            .transition(.dissolve)
    }

    /// Each state is laid out once at its final size; the clip reveals it.
    private func fixed<V: View>(_ mode: NotchModel.Mode, @ViewBuilder _ view: () -> V) -> some View {
        let s = model.size(for: mode)
        return view().frame(width: s.width, height: s.height, alignment: .top)
    }

    @ViewBuilder private var content: some View {
        switch model.mode {
        case .closed:
            if model.showsFocus {
                fixed(.closed) { FocusActivityView(inkwell: inkwell, height: notchH) }
                    .transition(.dissolve)
            } else if model.showsActivity, let activity = model.activity {
                fixed(.closed) { WorkActivityView(activity: activity, height: notchH) }
                    .transition(.dissolve)
            } else if model.showsLiveActivity {
                fixed(.closed) { LiveActivityView(hero: hero, height: notchH, art: model.wingArt) }
                    .transition(.dissolve)
            }
        case .expanded:
            fixed(.expanded) {
                VStack(spacing: 0) {
                    // Beside the camera: sections on the left; on the right what Inkwell is
                    // doing, or the time.
                    HStack {
                        TabBar(model: model, ns: tabs)
                        Spacer()
                        if let activity = model.activity {
                            ActivityPill(activity: activity).transition(.dissolve)
                        } else if model.tab != .home {
                            TimelineView(.everyMinute) { context in
                                Text(context.date, format: .dateTime.hour().minute())
                                    .font(.system(size: 12, weight: .semibold).monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            .transition(.dissolve)
                        }
                    }
                    .frame(height: notchH)
                    .padding(.horizontal, 22)

                    ZStack(alignment: .top) {
                        switch model.tab {
                        case .music:
                            Group {
                                if player.hasTrack { PlayerView(player: player, hero: hero) } else { NothingPlaying() }
                            }
                            .transition(.dissolve)
                        case .inkwell:
                            InkwellPanel(inkwell: inkwell).transition(.dissolve)
                        case .home:
                            IdleView().transition(.dissolve)
                        case .shelf:
                            ShelfView(model: model).transition(.dissolve)
                        case .inbox:
                            InboxView(model: model).transition(.dissolve)
                        }
                    }
                    .padding(.top, 10)
                    .padding(.horizontal, model.tab == .inbox || model.tab == .shelf ? 18 : 30)
                    .frame(maxHeight: .infinity, alignment: .top)
                }
            }
            .transition(.dissolve)
        case .stack:
            fixed(.stack) {
                ZStack(alignment: .top) {
                    if model.showsMusicWings {
                        LiveActivityView(hero: hero, height: notchH, art: model.wingArt)
                            .padding(.horizontal, 14)
                    }
                    NotificationStack(model: model)
                        .padding(.top, notchH + 8)
                        .padding(.horizontal, 14)
                }
            }
            .transition(.dissolve)
        case .airdrop:
            fixed(.airdrop) {
                DropZones(side: model.dropSide, targeted: model.dropTargeted)
                    .padding(.top, notchH + 6)
                    .padding(.horizontal, 18)
                    .padding(.bottom, 14)
            }
            .transition(.dissolve)
        }
    }
}

/// Files over the notch: which half they're over decides where they go.
struct NotchDrop: DropDelegate {
    let model: NotchModel

    func validateDrop(info: DropInfo) -> Bool { info.hasItemsConforming(to: [.fileURL]) }

    func dropEntered(info: DropInfo) {
        model.dropTargeted = true
        follow(info)
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        follow(info)
        return DropProposal(operation: .copy)
    }

    func dropExited(info: DropInfo) { model.dropTargeted = false }

    func performDrop(info: DropInfo) -> Bool {
        let providers = info.itemProviders(for: [.fileURL])
        let ok = model.handleDrop(providers)
        model.dropTargeted = false
        return ok
    }

    private func follow(_ info: DropInfo) {
        let side: NotchModel.DropSide = info.location.x < model.currentSize.width / 2 ? .shelf : .airdrop
        guard side != model.dropSide else { return }
        model.haptic(.alignment)
        withAnimation(.spring(response: 0.3, dampingFraction: 0.72)) { model.dropSide = side }
    }
}

// MARK: - Closed notch with music playing

/// Only slots: the real artwork and equalizer are drawn by NotchRootView and
/// matched onto these frames, so they glide into the open player.
struct LiveActivityView: View {
    let hero: Namespace.ID
    let height: CGFloat
    /// Square, or 16:9 when a video is playing.
    let art: CGSize

    var body: some View {
        HStack {
            Color.clear.frame(width: art.width, height: art.height)
                .matchedGeometryEffect(id: "art", in: hero)
            Spacer(minLength: 0)
            Color.clear.frame(width: 18, height: height - 16)
                .matchedGeometryEffect(id: "eq", in: hero)
        }
        .padding(.horizontal, 13)
        .frame(height: height)
    }
}

// MARK: - Expanded player

struct PlayerView: View {
    @ObservedObject var player: NowPlaying
    let hero: Namespace.ID

    var body: some View {
        HStack(spacing: 14) {
            // a video's picture keeps its 16:9 shape instead of being cut to a square
            Color.clear.frame(width: player.artWide ? 136 : 78, height: player.artWide ? 77 : 78)
                .matchedGeometryEffect(id: "art", in: hero)

            VStack(alignment: .leading, spacing: 7) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(player.title).font(.system(size: 14, weight: .semibold)).lineLimit(1)
                        Text(player.artist).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 8)
                    Color.clear.frame(width: 18, height: 14)
                        .matchedGeometryEffect(id: "eq", in: hero)
                        .padding(.top, 3)
                }
                ProgressRow(player: player)
                HStack(spacing: 30) {
                    ControlButton(symbol: "backward.fill", size: 15) { player.previous() }
                    ControlButton(symbol: player.isPlaying ? "pause.fill" : "play.fill", size: 21) { player.togglePlayPause() }
                    ControlButton(symbol: "forward.fill", size: 15) { player.next() }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .foregroundStyle(.white)
    }
}

struct ProgressRow: View {
    @ObservedObject var player: NowPlaying
    @State private var scrub: Double?

    var body: some View {
        // Only ticks while the expanded player is on screen.
        TimelineView(.periodic(from: .now, by: 0.5)) { context in
            let elapsed = scrub ?? player.elapsed(at: context.date)
            let fraction = player.duration > 0 ? elapsed / player.duration : 0
            HStack(spacing: 8) {
                Text(Self.format(elapsed)).frame(width: 34, alignment: .leading)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(.white.opacity(0.2))
                        Capsule().fill(.white).frame(width: geo.size.width * fraction)
                    }
                    .frame(height: scrub == nil ? 4 : 6)
                    .frame(maxHeight: .infinity)
                    .contentShape(Rectangle())
                    .gesture(DragGesture(minimumDistance: 0)
                        .onChanged { scrub = player.duration * min(max($0.location.x / geo.size.width, 0), 1) }
                        .onEnded { _ in
                            if let scrub { player.seek(to: scrub) }
                            scrub = nil
                        })
                    .animation(.spring(response: 0.25), value: scrub == nil)
                }
                .frame(height: 12)
                Text(Self.format(player.duration)).frame(width: 34, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .medium).monospacedDigit())
            .foregroundStyle(.secondary)
        }
    }

    static func format(_ t: Double) -> String {
        guard t.isFinite, t > 0 else { return "0:00" }
        let s = Int(t)
        return s >= 3600 ? String(format: "%d:%02d:%02d", s / 3600, s / 60 % 60, s % 60) : String(format: "%d:%02d", s / 60, s % 60)
    }
}

struct ControlButton: View {
    let symbol: String
    let size: CGFloat
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: size, weight: .semibold))
                .contentTransition(.symbolEffect(.replace))
                .frame(width: 34, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressStyle())
    }
}

struct PressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.82 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

struct Artwork: View {
    let image: NSImage?
    let fallback: NSImage?
    let radius: CGFloat

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image).resizable().aspectRatio(contentMode: .fill)
            } else if let fallback {
                Image(nsImage: fallback).resizable().aspectRatio(contentMode: .fit).padding(2)
            } else {
                Image(systemName: "music.note").foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity).background(.white.opacity(0.1))
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
    }
}

// MARK: - Idle

struct IdleView: View {
    var body: some View {
        HStack(spacing: 18) {
            TimelineView(.everyMinute) { context in
                VStack(alignment: .leading, spacing: 2) {
                    Text(context.date, format: .dateTime.hour().minute())
                        .font(.system(size: 34, weight: .semibold, design: .rounded))
                    Text(context.date, format: .dateTime.weekday(.wide).day().month(.wide))
                        .font(.system(size: 12)).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Button(action: NotchModel.openAirDropWindow) {
                VStack(spacing: 6) {
                    Image(systemName: "dot.radiowaves.up.forward").font(.system(size: 22, weight: .medium))
                    Text("AirDrop").font(.system(size: 11, weight: .medium))
                }
                .frame(width: 96, height: 76)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.08)))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(.white.opacity(0.18), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            }
            .buttonStyle(PressStyle())
        }
        .foregroundStyle(.white)
    }
}

// MARK: - AirDrop drop zone

struct CircleButton: View {
    let symbol: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(Circle().fill(color))
        }
        .buttonStyle(PressStyle())
    }
}

// MARK: - Inkwell

/// Closed notch during an Inkwell focus session: Inkwell on the left, the
/// countdown on the right (ticked by the system text timer, not by us).
struct FocusActivityView: View {
    @ObservedObject var inkwell: InkwellLink
    let height: CGFloat

    var body: some View {
        HStack {
            // Inky reads along while the focus timer runs
            InkyView(mood: .reading, pixel: (height - 8) / 16)
            Spacer(minLength: 0)
            if let start = inkwell.state?.focusStart, let end = inkwell.state?.focusEnd, end > start {
                Text(timerInterval: start...end, countsDown: true)
                    .font(.system(size: 13, weight: .semibold, design: .rounded).monospacedDigit())
                    .foregroundStyle(.white)
                    .frame(width: 48, alignment: .trailing)
            }
        }
        .padding(.horizontal, 12)
        .frame(height: height)
    }
}

/// The Inkwell section: today's streak and goal (or the focus timer), words
/// waiting, and the article in progress. Each tile opens that place in Inkwell.
struct InkwellPanel: View {
    @ObservedObject var inkwell: InkwellLink

    var body: some View {
        let s = inkwell.state
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                Tile(action: { inkwell.open("articles365://open") }) {
                    HStack(spacing: 8) {
                        InkyView(mood: s?.doneToday == true ? .happy : .idle, pixel: 1.5)
                        VStack(alignment: .leading, spacing: 0) {
                            Text("🔥 \(s?.streak ?? 0) kun").font(.system(size: 13, weight: .semibold))
                            Text("ketma-ket").font(.system(size: 10)).foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if inkwell.focusActive, let start = s?.focusStart, let end = s?.focusEnd {
                    Tile(action: { inkwell.open("articles365://focus") }) {
                        HStack(spacing: 8) {
                            Image(systemName: "timer").font(.system(size: 15, weight: .semibold))
                            VStack(alignment: .leading, spacing: 0) {
                                Text(timerInterval: start...end, countsDown: true)
                                    .font(.system(size: 13, weight: .semibold).monospacedDigit())
                                Text("fokus").font(.system(size: 10)).foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                } else {
                    Tile(action: { inkwell.open("articles365://open") }) {
                        HStack(spacing: 8) {
                            GoalRing(value: Double(s?.todayMin ?? 0), goal: Double(s?.goal ?? 15), done: s?.doneToday == true)
                            VStack(alignment: .leading, spacing: 0) {
                                Text("\(s?.todayMin ?? 0)/\(s?.goal ?? 15) daq").font(.system(size: 13, weight: .semibold))
                                Text("bugun").font(.system(size: 10)).foregroundStyle(.secondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }

                Tile(action: { inkwell.open("articles365://cards") }) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("\(s?.due ?? 0) so‘z").font(.system(size: 13, weight: .semibold))
                        Text((s?.due ?? 0) > 0 ? (s?.word ?? "takrorlash") : "hammasi takrorlangan")
                            .font(.system(size: 10)).foregroundStyle(.secondary).lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(height: 42)

            Tile(action: inkwell.openArticle) {
                HStack(spacing: 10) {
                    Image(systemName: "book.pages").font(.system(size: 14))
                    VStack(alignment: .leading, spacing: 5) {
                        Text(s?.title ?? "Bugungi maqola").font(.system(size: 12, weight: .medium)).lineLimit(1)
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule().fill(.white.opacity(0.18))
                                Capsule().fill(.white).frame(width: geo.size.width * CGFloat(s?.pct ?? 0) / 100)
                            }
                        }
                        .frame(height: 3)
                    }
                    Text(s?.left.map { "\($0) daq" } ?? "").font(.system(size: 11)).foregroundStyle(.secondary).fixedSize()
                }
            }
            .frame(height: 42)
        }
        .foregroundStyle(.white)
    }
}

/// Section switcher beside the camera; the highlight slides between icons.
struct TabBar: View {
    @ObservedObject var model: NotchModel
    let ns: Namespace.ID

    var body: some View {
        HStack(spacing: 2) {
            ForEach(model.tabs, id: \.self) { tab in
                Button { model.select(tab) } label: {
                    Image(systemName: tab.symbol)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(model.tab == tab ? .black : .white.opacity(0.6))
                        // the bell rings for a new notification, the tray hops when a file lands
                        .symbolEffect(.bounce, value: tab == .inbox ? model.unread : tab == .shelf ? model.shelfBump : 0)
                        .symbolEffect(.bounce.down, value: model.tab == tab)
                        .frame(width: 30, height: 22)
                        .background {
                            if model.tab == tab {
                                Capsule().fill(.white).matchedGeometryEffect(id: "tab", in: ns)
                            }
                        }
                        .contentShape(Capsule())
                        .overlay(alignment: .topTrailing) {
                            if tab == .inbox, model.unread > 0 {
                                Text(model.unread > 99 ? "99+" : "\(model.unread)")
                                    .font(.system(size: 8, weight: .bold).monospacedDigit())
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 3.5)
                                    .frame(minWidth: 13, minHeight: 13)
                                    .background(Capsule().fill(.red))
                                    .contentTransition(.numericText())
                                    .offset(x: 3, y: -3)
                                    .transition(.scale.combined(with: .opacity))
                            }
                        }
                }
                .buttonStyle(PressStyle())
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: model.unread)
    }
}

struct NothingPlaying: View {
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "music.note")
                .font(.system(size: 26))
                .foregroundStyle(.secondary)
                .frame(width: 78, height: 78)
                .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(.white.opacity(0.08)))
            VStack(alignment: .leading, spacing: 3) {
                Text("Hech narsa ijro etilmayapti").font(.system(size: 14, weight: .semibold))
                Text("Spotify, Music yoki brauzerda qo‘shiq qo‘ying — shu yerda chiqadi.")
                    .font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .foregroundStyle(.white)
    }
}

private struct Tile<Label: View>: View {
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    var body: some View {
        Button(action: action) {
            label()
                .padding(.horizontal, 10)
                .frame(maxHeight: .infinity)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(.white.opacity(0.08)))
                .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(PressStyle())
    }
}

private struct GoalRing: View {
    let value: Double
    let goal: Double
    let done: Bool

    var body: some View {
        ZStack {
            Circle().stroke(.white.opacity(0.18), lineWidth: 3)
            Circle().trim(from: 0, to: min(value / max(goal, 1), 1))
                .stroke(done ? Color.orange : .white, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
        .frame(width: 24, height: 24)
    }
}
