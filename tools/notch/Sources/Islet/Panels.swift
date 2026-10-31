import SwiftUI
import UniformTypeIdentifiers

/// Comes in from a blur, slightly above its place; leaves the same way.
private struct BlurLift: ViewModifier {
    let amount: CGFloat
    func body(content: Content) -> some View {
        content
            .blur(radius: 8 * amount)
            .opacity(1 - amount)
            .offset(y: -14 * amount)
            .scaleEffect(1 - 0.05 * amount, anchor: .top)
    }
}

extension AnyTransition {
    /// A row arriving at the top of a list: the rows below make room on the same spring.
    static var rowIn: AnyTransition {
        .asymmetric(insertion: .modifier(active: BlurLift(amount: 1), identity: BlurLift(amount: 0)),
                    removal: .modifier(active: BlurLift(amount: 1), identity: BlurLift(amount: 0)).combined(with: .scale(scale: 0.9)))
    }

    /// A tile popping onto the shelf.
    static var tileIn: AnyTransition {
        .asymmetric(insertion: .scale(scale: 0.5).combined(with: .opacity), removal: .scale(scale: 0.7).combined(with: .opacity))
    }
}

func ago(_ date: Date) -> String {
    let s = Date().timeIntervalSince(date)
    if s < 60 { return "hozir" }
    if s < 3600 { return "\(Int(s / 60)) daq" }
    if s < 86400 { return "\(Int(s / 3600)) soat" }
    return date.formatted(.dateTime.day().month(.abbreviated))
}

/// Small round ✕.
struct CloseDot: View {
    var size: CGFloat = 18
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "xmark")
                .font(.system(size: size * 0.42, weight: .bold))
                .foregroundStyle(.white.opacity(0.75))
                .frame(width: size, height: size)
                .background(Circle().fill(.white.opacity(0.14)))
                .contentShape(Circle().inset(by: -4))
        }
        .buttonStyle(PressStyle())
    }
}

/// A rounded pill button ("Tozalash", "+3 yana").
struct PillButton: View {
    let title: String
    var symbol: String? = nil
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let symbol { Image(systemName: symbol).font(.system(size: 9, weight: .bold)) }
                Text(title).font(.system(size: 10.5, weight: .semibold))
            }
            .foregroundStyle(.white.opacity(0.85))
            .padding(.horizontal, 9)
            .frame(height: 20)
            .background(Capsule().fill(.white.opacity(0.12)))
            .contentShape(Capsule())
        }
        .buttonStyle(PressStyle())
    }
}

// MARK: - Notifications on screen

/// Newest on top; three at most, the rest wait in the box ("+N").
struct NotificationStack: View {
    @ObservedObject var model: NotchModel

    var body: some View {
        VStack(spacing: NotchModel.rowGap) {
            ForEach(Array(model.stackShown)) { item in
                NotificationRow(item: item, model: model)
                    .frame(height: item.isCall ? NotchModel.callHeight : NotchModel.rowHeight)
                    .transition(.rowIn)
            }
            if model.live.count > 1 {
                HStack {
                    if model.stackMore > 0 {
                        PillButton(title: "+\(model.stackMore) yana — qutida", symbol: "bell.fill", action: model.openBox)
                            .contentTransition(.numericText())
                    }
                    Spacer()
                    PillButton(title: "Hammasini yopish", symbol: "xmark", action: model.closeStack)
                }
                .frame(height: 20)
                .padding(.horizontal, 4)
                .transition(.rowIn)
            }
        }
        .animation(NotchModel.row, value: model.stackMore)
    }
}

struct NotificationRow: View {
    let item: IncomingNotification
    @ObservedObject var model: NotchModel
    @State private var drag: CGFloat = 0
    @State private var swiped = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            if item.isCall {
                card
            } else {
                Button { if !swiped { model.activate(item) } } label: { card }
                    .buttonStyle(RowPress())
            }
            CloseDot(size: 16) { model.dismiss(item) }
                .padding(7)
        }
        .offset(x: drag)
        .opacity(Double(1 - min(abs(drag) / 260, 0.8)))
        .rotationEffect(.degrees(Double(drag / 60)), anchor: .top)
        // sideways off the notch, the way a banner is swiped away
        .simultaneousGesture(DragGesture(minimumDistance: 8)
            .onChanged { v in
                swiped = true
                drag = v.translation.width
            }
            .onEnded { v in
                if abs(v.predictedEndTranslation.width) > 140 {
                    withAnimation(.easeOut(duration: 0.18)) { drag = v.translation.width > 0 ? 420 : -420 }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.16) { model.dismiss(item) }
                } else {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.65)) { drag = 0 }
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { swiped = false }
            })
    }

    private var card: some View {
        HStack(spacing: 11) {
            leading.frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 5) {
                    Text(item.isCall ? "Qo‘ng‘iroq · \(item.appName)" : item.appName)
                        .font(.system(size: 10.5, weight: .medium)).foregroundStyle(.secondary).lineLimit(1)
                    Text("· \(ago(item.date))").font(.system(size: 10.5)).foregroundStyle(.tertiary)
                }
                .padding(.trailing, 18)
                Text(item.title.isEmpty ? item.appName : item.title)
                    .font(.system(size: 12.5, weight: .semibold)).lineLimit(1)
                if !item.detail.isEmpty {
                    Text(item.detail).font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let path = item.imagePath {
                // pictures and videos keep their own shape: a 16:9 frame stays wide
                FileThumb(url: URL(fileURLWithPath: path), side: 160, fill: false)
                    .frame(width: 76, height: 43)
                    .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .padding(.top, 8)
            }
            if item.isCall {
                HStack(spacing: 8) {
                    CircleButton(symbol: "xmark", color: .red) { model.dismiss(item) }
                    CircleButton(symbol: "phone.fill", color: .green) { model.activate(item) }
                }
                .padding(.top, 10)
            }
        }
        .padding(.horizontal, 11)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.075)))
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .foregroundStyle(.white)
    }

    @ViewBuilder private var leading: some View {
        if item.isCall {
            Image(systemName: "phone.fill")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 38, height: 38)
                .background(Circle().fill(.green))
                .symbolEffect(.pulse, options: .repeating)
        } else if let mood = item.inky {
            InkyView(mood: mood, pixel: 1.5)
        } else if let icon = item.icon {
            Image(nsImage: icon).resizable()
        } else {
            Image(systemName: "bell.fill").foregroundStyle(.secondary)
        }
    }
}

/// Press: a little smaller and lighter.
struct RowPress: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .brightness(configuration.isPressed ? 0.06 : 0)
            .animation(.spring(response: 0.25, dampingFraction: 0.65), value: configuration.isPressed)
    }
}

// MARK: - The box

struct InboxView: View {
    @ObservedObject var model: NotchModel

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 6) {
                Text("Xabarlar").font(.system(size: 13, weight: .semibold))
                Text("\(model.box.count)")
                    .font(.system(size: 12, weight: .medium).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
                Spacer()
                if !model.box.isEmpty {
                    PillButton(title: "Tozalash", symbol: "trash.fill", action: model.clearBox)
                        .transition(.dissolve)
                }
            }
            .frame(height: 24)
            .padding(.horizontal, 6)

            if model.box.isEmpty {
                HStack(spacing: 12) {
                    InkyView(mood: .sleep, pixel: 1.5)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Hozircha xabar yo‘q").font(.system(size: 12.5, weight: .semibold))
                        Text("Kelganlari shu yerda saqlanadi").font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .transition(.dissolve)
            } else {
                ScrollView {
                    LazyVStack(spacing: 4) {
                        ForEach(model.box) { item in
                            InboxRow(item: item, model: model).transition(.rowIn)
                        }
                    }
                }
                .scrollIndicators(.never)
            }
        }
        .foregroundStyle(.white)
        .animation(NotchModel.row, value: model.box.count)
    }
}

struct InboxRow: View {
    let item: IncomingNotification
    @ObservedObject var model: NotchModel

    var body: some View {
        ZStack(alignment: .trailing) {
            Button { item.openApp() } label: {
                HStack(spacing: 10) {
                    Group {
                        if let mood = item.inky { InkyView(mood: mood, pixel: 1) }
                        else if let icon = item.icon { Image(nsImage: icon).resizable() }
                        else { Image(systemName: item.isCall ? "phone.fill" : "bell.fill").foregroundStyle(.secondary) }
                    }
                    .frame(width: 30, height: 30)
                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 4) {
                            Text(item.title.isEmpty ? item.appName : item.title).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                            Text("· \(item.appName)").font(.system(size: 10.5)).foregroundStyle(.tertiary).lineLimit(1)
                        }
                        if !item.detail.isEmpty {
                            Text(item.detail).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    if let path = item.imagePath {
                        FileThumb(url: URL(fileURLWithPath: path), side: 120, fill: false)
                            .frame(width: 54, height: 30)
                            .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                    }
                    Text(ago(item.date)).font(.system(size: 10).monospacedDigit()).foregroundStyle(.tertiary)
                        .padding(.trailing, 24)
                }
                .padding(.horizontal, 10)
                .frame(height: NotchModel.inboxRow)
                .background(RoundedRectangle(cornerRadius: 13, style: .continuous).fill(.white.opacity(0.06)))
                .contentShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
            }
            .buttonStyle(RowPress())
            CloseDot(size: 16) { model.remove(fromBox: item) }
                .padding(.trailing, 9)
        }
    }
}

// MARK: - The shelf

struct ShelfView: View {
    @ObservedObject var model: NotchModel

    var body: some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                Text("Shelf").font(.system(size: 13, weight: .semibold))
                Text("\(model.shelf.count)")
                    .font(.system(size: 12, weight: .medium).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
                Spacer()
                if !model.shelf.isEmpty {
                    PillButton(title: "Tozalash", symbol: "trash.fill", action: model.clearShelf)
                        .transition(.dissolve)
                }
            }
            .frame(height: 24)
            .padding(.horizontal, 6)

            if model.shelf.isEmpty {
                HStack(spacing: 10) {
                    Image(systemName: "tray.and.arrow.down.fill").font(.system(size: 20, weight: .medium))
                        .symbolEffect(.bounce, value: model.shelfBump)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Faylni notch’ga olib keling").font(.system(size: 12.5, weight: .semibold))
                        Text("Chap tomonga tashlasangiz shu yerda qadalib turadi").font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(.white.opacity(0.05)))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(.white.opacity(0.18), style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
                .transition(.dissolve)
            } else {
                ScrollView(.horizontal) {
                    HStack(spacing: 8) {
                        ForEach(model.shelf) { item in
                            ShelfTile(item: item, model: model).transition(.tileIn)
                        }
                    }
                    .padding(.horizontal, 4)
                    .padding(.top, 6)
                }
                .scrollIndicators(.never)
            }
        }
        .foregroundStyle(.white)
        .animation(NotchModel.row, value: model.shelf.count)
    }
}

struct ShelfTile: View {
    let item: ShelfItem
    @ObservedObject var model: NotchModel

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Button { NSWorkspace.shared.open(item.url) } label: {
                VStack(spacing: 5) {
                    FileThumb(url: item.url, side: 140)
                        .frame(width: 66, height: 54)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .shadow(color: .black.opacity(0.4), radius: 4, y: 2)
                    Text(item.name)
                        .font(.system(size: 9.5, weight: .medium))
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .frame(width: 74)
                }
                .padding(.vertical, 4)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressStyle())
            // dragged out of the notch into Finder, Mail, Telegram… it stays here too
            .onDrag { NSItemProvider(contentsOf: item.url) ?? NSItemProvider() }
            CloseDot(size: 16) { model.unpin(item) }
                .offset(x: 4, y: -4)
        }
    }
}

// MARK: - Files over the notch

struct DropZones: View {
    let side: NotchModel.DropSide
    let targeted: Bool

    var body: some View {
        HStack(spacing: 10) {
            zone(on: side == .shelf, symbol: "tray.and.arrow.down.fill", title: "Shelf’ga qadash", note: "Notch’da turadi")
            zone(on: side == .airdrop, symbol: "dot.radiowaves.up.forward", title: "AirDrop", note: "Yaqin qurilmaga")
        }
        .foregroundStyle(.white)
    }

    private func zone(on: Bool, symbol: String, title: String, note: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: symbol)
                .font(.system(size: 24, weight: .medium))
                .symbolEffect(.bounce, value: on)
                .scaleEffect(on ? 1.12 : 1)
            Text(title).font(.system(size: 12, weight: .semibold))
            Text(note).font(.system(size: 10.5)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(.white.opacity(on ? 0.14 : 0.04)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .strokeBorder(on ? .white.opacity(0.75) : .white.opacity(0.2), style: StrokeStyle(lineWidth: on ? 1.5 : 1, dash: on ? [] : [6, 4])))
        .opacity(on ? 1 : 0.6)
        .scaleEffect(on ? 1 : 0.97)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: on)
    }
}

// MARK: - Inkwell working in the background

/// Closed notch: Inky at work on the left, how far it got on the right.
struct WorkActivityView: View {
    let activity: InkwellActivity
    let height: CGFloat

    var body: some View {
        HStack {
            InkyView(mood: activity.done ? .happy : .reading, pixel: (height - 8) / 16)
            Spacer(minLength: 0)
            ActivityRing(activity: activity, size: height - 14)
        }
        .padding(.horizontal, 12)
        .frame(height: height)
    }
}

/// A ring that fills with the progress (or turns, when there's no number), then a tick.
struct ActivityRing: View {
    let activity: InkwellActivity
    let size: CGFloat
    @State private var turn = false

    var body: some View {
        ZStack {
            if activity.done {
                Image(systemName: "checkmark.circle.fill")
                    .resizable()
                    .foregroundStyle(.white)
                    .transition(.scale(scale: 0.3).combined(with: .opacity))
            } else {
                Circle().stroke(.white.opacity(0.2), lineWidth: 2.4)
                if let p = activity.progress {
                    Circle().trim(from: 0, to: max(p, 0.03))
                        .stroke(.white, style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                        .animation(.easeOut(duration: 0.4), value: p)
                } else {
                    Circle().trim(from: 0, to: 0.28)
                        .stroke(.white, style: StrokeStyle(lineWidth: 2.4, lineCap: .round))
                        .rotationEffect(.degrees(turn ? 360 : 0))
                        .onAppear {
                            withAnimation(.linear(duration: 0.9).repeatForever(autoreverses: false)) { turn = true }
                        }
                }
            }
        }
        .frame(width: size, height: size)
        .animation(.spring(response: 0.4, dampingFraction: 0.6), value: activity.done)
    }
}

/// In the open notch, beside the camera: what Inkwell is doing right now.
struct ActivityPill: View {
    let activity: InkwellActivity

    var body: some View {
        HStack(spacing: 6) {
            ActivityRing(activity: activity, size: 11)
            Text(activity.title).font(.system(size: 11, weight: .semibold)).lineLimit(1)
            if !activity.done, let p = activity.progress {
                Text("\(Int(p * 100))%")
                    .font(.system(size: 11, weight: .medium).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText(value: p))
            }
        }
        .padding(.horizontal, 9)
        .frame(height: 20)
        .background(Capsule().fill(.white.opacity(0.1)))
        .foregroundStyle(.white)
        .animation(.easeOut(duration: 0.3), value: activity)
    }
}

// MARK: - A phone call

/// The notch dropped down for a ringing call: who it is, rings going out from them, and the two
/// round buttons. Parts arrive one after another as the shape lands.
struct CallView: View {
    let item: IncomingNotification
    @ObservedObject var model: NotchModel
    @State private var shown = false

    private var name: String { item.title.isEmpty ? "Noma’lum raqam" : item.title }

    var body: some View {
        HStack(spacing: 14) {
            CallerAvatar(name: name, icon: item.icon, ringing: model.callStart == nil)
                .frame(width: 54, height: 54)
                .scaleEffect(shown ? 1 : 0.6)
                .blur(radius: shown ? 0 : 6)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Image(systemName: "iphone.radiowaves.left.and.right")
                        .symbolEffect(.variableColor.iterative, options: .repeating)
                    Text(model.inCall ? "Suhbat" : item.appName == "FaceTime" ? "Qo‘ng‘iroq" : "Qo‘ng‘iroq · \(item.appName)")
                }
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.secondary)
                Text(name)
                    .font(.system(size: 19, weight: .semibold))
                    .lineLimit(1)
                if !item.body.isEmpty {
                    Text(item.body).font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : -8)
            Group {
                if let start = model.callStart {
                    // the call going on: its time, mute and end
                    HStack(spacing: 12) {
                        Text(start, style: .timer)
                            .font(.system(size: 15, weight: .semibold, design: .rounded).monospacedDigit())
                            .foregroundStyle(.green)
                            .frame(width: 56, alignment: .trailing)
                        CallButton(symbol: model.muted ? "mic.slash.fill" : "mic.fill", color: Color(white: model.muted ? 0.9 : 0.28),
                                   tint: model.muted ? .black : .white, action: model.muteCall)
                        CallButton(symbol: "phone.down.fill", color: .red, action: model.hangUp)
                    }
                } else {
                    HStack(spacing: 14) {
                        CallButton(symbol: "phone.down.fill", color: .red, action: model.declineCall)
                        CallButton(symbol: "phone.fill", color: .green, glow: true, action: model.acceptCall)
                    }
                }
            }
            .scaleEffect(shown ? 1 : 0.4)
            .opacity(shown ? 1 : 0)
        }
        .foregroundStyle(.white)
        .onAppear {
            withAnimation(.spring(response: 0.5, dampingFraction: 0.7).delay(0.12)) { shown = true }
        }
    }
}

/// Initials in a soft circle (the app's icon when there's no name), with rings going out while
/// it rings.
struct CallerAvatar: View {
    let name: String
    let icon: NSImage?
    var ringing = true
    @State private var wave = false

    private var initials: String {
        let parts = name.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty || name.first?.isNumber == true ? "" : letters.uppercased()
    }

    var body: some View {
        ZStack {
            if ringing { ForEach(0..<2) { i in
                Circle()
                    .stroke(.green.opacity(0.7), lineWidth: 1.5)
                    .scaleEffect(wave ? 1.55 : 1)
                    .opacity(wave ? 0 : 0.8)
                    .animation(.easeOut(duration: 1.6).repeatForever(autoreverses: false).delay(Double(i) * 0.8), value: wave)
            } }
            Circle().fill(LinearGradient(colors: [Color(white: 0.42), Color(white: 0.24)], startPoint: .top, endPoint: .bottom))
            if !initials.isEmpty {
                Text(initials).font(.system(size: 20, weight: .semibold, design: .rounded))
            } else if let icon {
                Image(nsImage: icon).resizable().padding(8)
            } else {
                Image(systemName: "person.fill").font(.system(size: 22))
            }
        }
        .onAppear { wave = true }
    }
}

struct CallButton: View {
    let symbol: String
    let color: Color
    var tint: Color = .white
    var glow = false
    let action: () -> Void
    @State private var pulse = false

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(tint)
                .contentTransition(.symbolEffect(.replace))
                .rotationEffect(.degrees(glow && pulse ? -12 : 0))
                .frame(width: 46, height: 46)
                .background(Circle().fill(color))
                .background(Circle().fill(color.opacity(glow ? 0.45 : 0)).scaleEffect(pulse ? 1.35 : 1).blur(radius: 6))
                .contentShape(Circle())
        }
        .buttonStyle(PressStyle())
        .onAppear {
            guard glow else { return }
            withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) { pulse = true }
        }
    }
}

/// A call going on, beside the closed notch: a green phone and how long it's been.
struct InCallView: View {
    let start: Date
    let height: CGFloat

    var body: some View {
        HStack {
            HStack(spacing: 6) {
                Image(systemName: "phone.fill")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: height - 12, height: height - 12)
                    .background(Circle().fill(.green))
                Equalizer(color: .green, playing: true).frame(width: 16, height: height - 18)
            }
            Spacer(minLength: 0)
            Text(start, style: .timer)
                .font(.system(size: 13, weight: .semibold, design: .rounded).monospacedDigit())
                .foregroundStyle(.green)
                .frame(width: 52, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .frame(height: height)
    }
}
