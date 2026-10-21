// Desktop / Notification Center widgets for the reader, built without Xcode
// (scripts/build-widget.sh puts them in the app's Contents/PlugIns).
// A widget is sandboxed and there is no App Group without a developer team, so the reader
// writes widget.json straight into this extension's own container
// (~/Library/Containers/uz.javohir.articles365.widget/Data/widget.json), the one place the
// widget may read; notify.js keeps it fresh and asks for a reload through bin "Reminder".
// A tap opens the app through its articles365:// scheme (build-widget.sh registers it).
//
// Five widgets: streak (S/M/L), focus session with a live countdown (S/M), words to review
// (S/M, the translation stays blurred like a flash card), today's goal ring + week (S/M)
// and the article being read (S/M).
import SwiftUI
import WidgetKit

struct Word: Codable, Hashable {
  var w: String
  var tr: String
}

struct FocusInfo: Codable {
  var min: Int = 0 // focused minutes today
  var sessions: Int = 0
  var away: Int = 0 // times the window was left during a session today
  var start: Double? = nil // a running session, ms since 1970
  var ends: Double? = nil
  var title: String? = nil
  var week: [Int] = [] // focused minutes, the last 7 days
}

struct Info: Codable {
  var lang: String = "uz"
  var streak: Int = 0
  var best: Int = 0
  var doneToday: Bool = false
  var todayMin: Int = 0
  var due: Int = 0
  var word: String? = nil
  var tr: String? = nil
  var words: [Word]? = nil // a few due words, the longest waiting first
  var vocab: Int? = nil // words saved in all
  var id: String? = nil // the article below
  var title: String? = nil
  var pct: Int? = nil
  var left: Int? = nil // minutes still to read in it
  var goal: Int? = nil // daily goal, minutes
  var week: [Bool] = [] // the last 7 days, oldest first; true = read
  var mins: [Int]? = nil // minutes read, the last 7 days
  var heat: [Int]? = nil // minutes read, the last 28 days
  var focus: FocusInfo? = nil
  var day: String? = nil // YYYY-MM-DD the file was written on

  var goalMin: Int { max(1, goal ?? 15) }
  var dueWords: [Word] { words ?? (word.map { [Word(w: $0, tr: tr ?? "")] } ?? []) }
  var running: (Date, Date)? {
    guard let f = focus, let s = f.start, let e = f.ends else { return nil }
    return (Date(timeIntervalSince1970: s / 1000), Date(timeIntervalSince1970: e / 1000))
  }
}

// the file may be from an earlier day (the reader was closed): move it on to today
func load(now: Date = .now) -> Info {
  let url = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("widget.json")
  guard let d = try? Data(contentsOf: url), var i = try? JSONDecoder().decode(Info.self, from: d) else { return Info() }
  let f = DateFormatter()
  f.dateFormat = "yyyy-MM-dd"
  guard let s = i.day, let then = f.date(from: s) else { return i }
  let cal = Calendar.current
  let gap = cal.dateComponents([.day], from: cal.startOfDay(for: then), to: cal.startOfDay(for: now)).day ?? 0
  if gap <= 0 { return i }
  if gap > 1 || !i.doneToday { i.streak = 0 } // a whole day was missed
  i.doneToday = false
  i.todayMin = 0
  let shift = { (a: [Int], n: Int) in Array((a + Array(repeating: 0, count: min(gap, n))).suffix(n)) }
  i.week = Array((i.week + Array(repeating: false, count: min(gap, 7))).suffix(7))
  if let m = i.mins { i.mins = shift(m, 7) }
  if let h = i.heat { i.heat = shift(h, 28) }
  if var fo = i.focus {
    fo.min = 0
    fo.sessions = 0
    fo.away = 0
    fo.week = shift(fo.week, 7)
    i.focus = fo
  }
  return i
}

/* ---------------- timelines ---------------- */

struct Entry: TimelineEntry {
  let date: Date
  let info: Info
  var slot: Int = 0 // which due word this entry shows
}

let sample = Info(
  streak: 12, best: 12, doneToday: true, todayMin: 11, due: 4, word: "hypnosis", tr: "гипноз",
  words: [Word(w: "hypnosis", tr: "гипноз"), Word(w: "resilient", tr: "chidamli"), Word(w: "to wane", tr: "susaymoq"), Word(w: "scarce", tr: "kam, tanqis")],
  vocab: 214, id: nil, title: "What You Need to Know About Hypnosis", pct: 63, left: 4, goal: 15,
  week: [true, true, false, true, true, true, true], mins: [14, 22, 0, 9, 31, 18, 11],
  heat: [5, 0, 12, 20, 8, 0, 0, 15, 22, 30, 4, 0, 18, 9, 14, 22, 0, 9, 31, 18, 11, 25, 0, 7, 16, 28, 19, 11],
  focus: FocusInfo(min: 25, sessions: 1, away: 2, week: [0, 25, 0, 45, 10, 25, 25])
)

struct Provider: TimelineProvider {
  var rotate = false // the words widget shows the next due word every 20 minutes
  func placeholder(in context: Context) -> Entry { Entry(date: .now, info: sample) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : Entry(date: .now, info: load()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    // the reader asks for a reload when something changes; this is only the fallback,
    // plus one entry just after midnight so the day turns over even with the reader closed,
    // and one when a running focus session ends
    let cal = Calendar.current
    let now = Date.now
    let midnight = cal.date(byAdding: .second, value: 5, to: cal.startOfDay(for: cal.date(byAdding: .day, value: 1, to: now)!))!
    let info = load()
    var entries = [Entry(date: now, info: info)]
    if rotate, info.dueWords.count > 1 {
      for k in 1..<min(info.dueWords.count, 6) {
        entries.append(Entry(date: now.addingTimeInterval(Double(k) * 20 * 60), info: info, slot: k))
      }
    }
    if let (_, end) = info.running, end > now { entries.append(Entry(date: end.addingTimeInterval(1), info: info)) }
    entries.append(Entry(date: midnight, info: load(now: midnight)))
    entries.sort { $0.date < $1.date }
    completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(15 * 60))))
  }
}

/* ---------------- texts ---------------- */

func L(_ i: Info, _ k: String, _ n: Int = 0) -> String {
  let ru = n % 10 == 1 && n % 100 != 11 ? "день" : (2...4).contains(n % 10) && !(12...14).contains(n % 100) ? "дня" : "дней"
  let t: [String: [String: String]] = [
    "uz": [
      "days": "kun", "done": "Bugun bajarildi", "todo": "Bugun hali o'qilmadi", "due": "\(n) ta so'z takrorlashga", "noDue": "So'zlar takrorlangan",
      "cont": "Davom ettirish", "start": "Bugungi maqolani boshlang", "min": "\(n) daq.", "left": "≈ \(n) daq. qoldi",
      "focus": "Fokus", "focusing": "Fokusdasiz", "fStart": "Fokusni boshlash", "fToday": "bugun fokusda", "sessions": "\(n) sessiya",
      "away": "\(n) marta chalg'idi", "noAway": "Chalg'imadingiz", "fEnd": "tugaydi", "fDone": "Sessiya tugadi",
      "words": "So'zlar", "tap": "Tarjimani ko'rish uchun bosing", "saved": "\(n) ta so'z lug'atda", "goal": "Kunlik maqsad",
      "of": "/ \(n) daq.", "goalDone": "Maqsad bajarildi", "goalLeft": "Yana \(n) daq.", "weekTot": "Shu hafta: \(n) daq.",
      "best": "Rekord: \(n)", "month": "So'nggi 4 hafta", "noArt": "Kutubxonadan maqola tanlang",
      "wd": "D,S,C,P,J,Sh,Y",
    ],
    "en": [
      "days": n == 1 ? "day" : "days", "done": "Done for today", "todo": "Not read yet today", "due": "\(n) words to review", "noDue": "All words reviewed",
      "cont": "Continue", "start": "Start today's article", "min": "\(n) min", "left": "≈ \(n) min left",
      "focus": "Focus", "focusing": "Focusing", "fStart": "Start focus", "fToday": "focused today", "sessions": n == 1 ? "1 session" : "\(n) sessions",
      "away": n == 1 ? "Left once" : "Left \(n) times", "noAway": "No distractions", "fEnd": "ends", "fDone": "Session complete",
      "words": "Words", "tap": "Tap to see the translation", "saved": "\(n) words saved", "goal": "Daily goal",
      "of": "/ \(n) min", "goalDone": "Goal reached", "goalLeft": "\(n) min to go", "weekTot": "This week: \(n) min",
      "best": "Best: \(n)", "month": "Last 4 weeks", "noArt": "Pick an article in the library",
      "wd": "M,T,W,T,F,S,S",
    ],
    "ru": [
      "days": ru, "done": "Сегодня выполнено", "todo": "Сегодня ещё не читал(а)", "due": "\(n) слов на повтор", "noDue": "Все слова повторены",
      "cont": "Продолжить", "start": "Начни сегодняшнюю статью", "min": "\(n) мин", "left": "≈ \(n) мин осталось",
      "focus": "Фокус", "focusing": "В фокусе", "fStart": "Начать фокус", "fToday": "в фокусе сегодня", "sessions": "сессий: \(n)",
      "away": "отвлечений: \(n)", "noAway": "Без отвлечений", "fEnd": "до конца", "fDone": "Сессия завершена",
      "words": "Слова", "tap": "Нажми, чтобы увидеть перевод", "saved": "\(n) слов в словаре", "goal": "Цель на день",
      "of": "/ \(n) мин", "goalDone": "Цель выполнена", "goalLeft": "Ещё \(n) мин", "weekTot": "За неделю: \(n) мин",
      "best": "Рекорд: \(n)", "month": "Последние 4 недели", "noArt": "Выбери статью в библиотеке",
      "wd": "П,В,С,Ч,П,С,В",
    ],
  ]
  return (t[i.lang] ?? t["uz"]!)[k] ?? k
}

// weekday letters for the last 7 days, oldest first
func weekdays(_ i: Info) -> [String] {
  let names = L(i, "wd").split(separator: ",").map(String.init) // Monday first
  let cal = Calendar.current
  return (0..<7).reversed().map { back in
    let d = cal.date(byAdding: .day, value: -back, to: .now)!
    let wd = (cal.component(.weekday, from: d) + 5) % 7 // Sunday = 1 → 6
    return names.indices.contains(wd) ? names[wd] : ""
  }
}

func link(_ s: String) -> URL { URL(string: "articles365://\(s)")! }

/* ---------------- shared pieces ---------------- */

let orange = Color(red: 1.0, green: 0.42, blue: 0.23)
let amber = Color(red: 1.0, green: 0.62, blue: 0.26)
// one warm family, a hue each: the streak and the words in orange, focus in candle-light honey,
// the daily goal in coral — like the flame, nothing green or blue next to it
let calm = Color(red: 0.97, green: 0.66, blue: 0.18) // focus: honey
let calm2 = Color(red: 1.0, green: 0.80, blue: 0.38)
let leaf = Color(red: 1.0, green: 0.42, blue: 0.40) // goal: coral
let leaf2 = Color(red: 1.0, green: 0.62, blue: 0.47)
let fire = LinearGradient(colors: [amber, orange], startPoint: .top, endPoint: .bottom)

struct Flame: View {
  let lit: Bool
  var size: CGFloat = 30
  var body: some View {
    Image(systemName: "flame.fill")
      .font(.system(size: size, weight: .semibold))
      .foregroundStyle(lit ? AnyShapeStyle(fire) : AnyShapeStyle(Color.secondary.opacity(0.45)))
  }
}

struct Week: View {
  let days: [Bool]
  var body: some View {
    HStack(spacing: 4) {
      ForEach(Array(days.suffix(7).enumerated()), id: \.offset) { _, on in
        RoundedRectangle(cornerRadius: 3, style: .continuous)
          .fill(on ? AnyShapeStyle(fire) : AnyShapeStyle(Color.secondary.opacity(0.18)))
          .frame(height: 6)
      }
    }
  }
}

// a small caption with an icon, the widgets' header
struct Head: View {
  let icon: String
  let text: String
  var tint: Color = .secondary
  var body: some View {
    HStack(spacing: 5) {
      Image(systemName: icon).font(.system(size: 10, weight: .bold))
      Text(text).font(.system(size: 10.5, weight: .semibold)).textCase(.uppercase).tracking(0.4)
    }
    .foregroundStyle(tint)
    .lineLimit(1)
  }
}

struct Bar: View {
  let p: Double
  var tint: AnyShapeStyle = AnyShapeStyle(orange)
  var h: CGFloat = 4
  var body: some View {
    GeometryReader { g in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.secondary.opacity(0.18))
        Capsule().fill(tint).frame(width: max(h, g.size.width * CGFloat(min(1, max(0, p)))))
      }
    }
    .frame(height: h)
  }
}

// a ring that starts at the top; the stroke ends are rounded
struct Ring: View {
  let p: Double
  let colors: [Color]
  var width: CGFloat = 9
  var body: some View {
    ZStack {
      Circle().stroke(Color.secondary.opacity(0.16), lineWidth: width)
      Circle()
        .trim(from: 0, to: max(0.001, min(1, p)))
        .stroke(AngularGradient(colors: colors + [colors[0]], center: .center, startAngle: .degrees(-90), endAngle: .degrees(270)), style: StrokeStyle(lineWidth: width, lineCap: .round))
        .rotationEffect(.degrees(-90))
      if p > 1 {
        // past the goal: a second lap, a little brighter
        Circle()
          .trim(from: 0, to: min(1, p - 1))
          .stroke(colors.last!.opacity(0.9), style: StrokeStyle(lineWidth: width, lineCap: .round))
          .rotationEffect(.degrees(-90))
      }
    }
  }
}

// one column per day; the tallest day fills the height
struct Columns: View {
  let values: [Int]
  let labels: [String]
  let colors: [Color]
  var today = true
  var body: some View {
    let top = max(1, values.max() ?? 1)
    HStack(alignment: .bottom, spacing: 6) {
      ForEach(Array(values.enumerated()), id: \.offset) { k, v in
        VStack(spacing: 4) {
          GeometryReader { g in
            VStack(spacing: 0) {
              Spacer(minLength: 0)
              RoundedRectangle(cornerRadius: 4, style: .continuous)
                .fill(v > 0 ? AnyShapeStyle(LinearGradient(colors: colors.reversed(), startPoint: .top, endPoint: .bottom)) : AnyShapeStyle(Color.secondary.opacity(0.16)))
                .frame(height: max(5, g.size.height * CGFloat(v) / CGFloat(top)))
                .opacity(today && k == values.count - 1 || v == 0 ? 1 : 0.78)
            }
          }
          Text(labels.indices.contains(k) ? labels[k] : "")
            .font(.system(size: 9, weight: k == values.count - 1 ? .bold : .medium))
            .foregroundStyle(k == values.count - 1 ? .primary : .secondary)
        }
      }
    }
  }
}

/* ---------------- streak ---------------- */

struct StreakSmall: View {
  let i: Info
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline, spacing: 6) {
        Flame(lit: i.streak > 0 && i.doneToday, size: 26)
        Text("\(i.streak)").font(.system(size: 38, weight: .bold, design: .rounded)).monospacedDigit()
        Text(L(i, "days", i.streak)).font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
      }
      Spacer(minLength: 0)
      Week(days: i.week)
      Text(i.doneToday ? L(i, "done") : L(i, "todo"))
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(i.doneToday ? AnyShapeStyle(orange) : AnyShapeStyle(.secondary))
        .lineLimit(1)
      if i.due > 0 {
        Text(L(i, "due", i.due)).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct ArticleBlock: View {
  let i: Info
  var lines = 2
  var body: some View {
    if let t = i.title {
      VStack(alignment: .leading, spacing: 4) {
        Text(i.pct != nil && i.pct! > 0 ? L(i, "cont") : L(i, "start")).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).textCase(.uppercase)
        Text(t).font(.system(size: 12, weight: .medium)).lineLimit(lines)
        if let p = i.pct, p > 0 { Bar(p: Double(p) / 100) }
      }
    }
  }
}

struct StreakMedium: View {
  let i: Info
  var body: some View {
    HStack(spacing: 14) {
      StreakSmall(i: i).frame(width: 128)
      Rectangle().fill(Color.secondary.opacity(0.15)).frame(width: 1)
      VStack(alignment: .leading, spacing: 8) {
        if let w = i.dueWords.first {
          VStack(alignment: .leading, spacing: 1) {
            Text(w.w).font(.system(size: 19, weight: .semibold, design: .serif)).lineLimit(1)
            Text(w.tr).font(.system(size: 12)).foregroundStyle(.secondary).lineLimit(1)
          }
        } else {
          Text(L(i, "noDue")).font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
        ArticleBlock(i: i)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

// the large one: the streak, four weeks of reading as a heat map, and what's next
struct StreakLarge: View {
  let i: Info
  var body: some View {
    let heat = Array(((i.heat ?? []).count == 28 ? i.heat! : Array(repeating: 0, count: 28 - min(28, (i.heat ?? []).count)) + (i.heat ?? [])).suffix(28))
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .firstTextBaseline, spacing: 7) {
        Flame(lit: i.streak > 0 && i.doneToday, size: 30)
        Text("\(i.streak)").font(.system(size: 46, weight: .bold, design: .rounded)).monospacedDigit()
        Text(L(i, "days", i.streak)).font(.system(size: 15, weight: .medium)).foregroundStyle(.secondary)
        Spacer()
        VStack(alignment: .trailing, spacing: 2) {
          Text(i.doneToday ? L(i, "done") : L(i, "todo")).font(.system(size: 12, weight: .semibold)).foregroundStyle(i.doneToday ? AnyShapeStyle(orange) : AnyShapeStyle(.secondary))
          Text(L(i, "best", max(i.best, i.streak))).font(.system(size: 11)).foregroundStyle(.secondary)
        }
      }
      VStack(alignment: .leading, spacing: 6) {
        Text(L(i, "month")).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).textCase(.uppercase)
        let top = Double(max(i.goalMin, heat.max() ?? 1))
        Grid(horizontalSpacing: 5, verticalSpacing: 5) {
          ForEach(0..<4, id: \.self) { r in
            GridRow {
              ForEach(0..<7, id: \.self) { c in
                let v = heat[r * 7 + c]
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                  .fill(v > 0 ? AnyShapeStyle(fire.opacity(0.28 + 0.72 * min(1, Double(v) / top))) : AnyShapeStyle(Color.secondary.opacity(0.12)))
                  .overlay(r == 3 && c == 6 ? RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(Color.primary.opacity(0.35), lineWidth: 1.2) : nil)
                  .frame(height: 28)
              }
            }
          }
        }
      }
      Rectangle().fill(Color.secondary.opacity(0.15)).frame(height: 1)
      HStack(alignment: .top, spacing: 14) {
        VStack(alignment: .leading, spacing: 3) {
          Text(L(i, "words")).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).textCase(.uppercase)
          if let w = i.dueWords.first {
            Text(w.w).font(.system(size: 17, weight: .semibold, design: .serif)).lineLimit(1)
            Text(w.tr).font(.system(size: 11.5)).foregroundStyle(.secondary).lineLimit(1)
            Text(L(i, "due", i.due)).font(.system(size: 10.5)).foregroundStyle(orange).lineLimit(1)
          } else {
            Text(L(i, "noDue")).font(.system(size: 12, weight: .medium)).foregroundStyle(.secondary)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        ArticleBlock(i: i, lines: 3).frame(maxWidth: .infinity, alignment: .leading)
      }
      Spacer(minLength: 0)
    }
  }
}

struct StreakView: View {
  @Environment(\.widgetFamily) var family
  let entry: Entry
  var body: some View {
    switch family {
    case .systemSmall: StreakSmall(i: entry.info)
    case .systemLarge: StreakLarge(i: entry.info)
    default: StreakMedium(i: entry.info)
    }
  }
}

/* ---------------- focus ---------------- */

struct FocusRunning: View {
  let i: Info
  let start: Date
  let end: Date
  var wide = false
  var body: some View {
    VStack(alignment: .leading, spacing: wide ? 8 : 6) {
      HStack {
        Head(icon: "scope", text: L(i, "focusing"), tint: calm)
        Spacer()
      }
      Spacer(minLength: 0)
      // counts down by itself; the widget isn't reloaded for every second
      Text(timerInterval: start...end, countsDown: true)
        .font(.system(size: wide ? 44 : 36, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(LinearGradient(colors: [calm2, calm], startPoint: .leading, endPoint: .trailing))
        .lineLimit(1)
        .minimumScaleFactor(0.7)
      ProgressView(timerInterval: start...end, countsDown: false, label: { EmptyView() }, currentValueLabel: { EmptyView() })
        .progressViewStyle(.linear)
        .tint(calm)
      if let t = i.focus?.title {
        Text(t).font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary).lineLimit(wide ? 2 : 1)
      }
    }
  }
}

struct FocusIdle: View {
  let i: Info
  var body: some View {
    let f = i.focus ?? FocusInfo()
    VStack(alignment: .leading, spacing: 6) {
      Head(icon: "scope", text: L(i, "focus"), tint: calm)
      Spacer(minLength: 0)
      HStack(alignment: .firstTextBaseline, spacing: 4) {
        Text("\(f.min)").font(.system(size: 38, weight: .bold, design: .rounded)).monospacedDigit()
        Text(L(i, "min", f.min).replacingOccurrences(of: "\(f.min)", with: "").trimmingCharacters(in: .whitespaces))
          .font(.system(size: 13, weight: .medium)).foregroundStyle(.secondary)
      }
      Text(L(i, "fToday")).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1)
      Spacer(minLength: 0)
      HStack(spacing: 5) {
        Image(systemName: "play.fill").font(.system(size: 9, weight: .bold))
        Text(L(i, "fStart")).font(.system(size: 11.5, weight: .semibold)).lineLimit(1)
      }
      .foregroundStyle(Color(red: 0.22, green: 0.12, blue: 0.02)) // dark on honey reads better than white
      .padding(.horizontal, 10)
      .frame(height: 24)
      .background(Capsule().fill(LinearGradient(colors: [calm2, calm], startPoint: .leading, endPoint: .trailing)))
    }
  }
}

struct FocusMedium: View {
  let i: Info
  var body: some View {
    let f = i.focus ?? FocusInfo()
    HStack(spacing: 14) {
      Group {
        if let (s, e) = i.running, e > .now { FocusRunning(i: i, start: s, end: e) } else { FocusIdle(i: i) }
      }
      .frame(width: 140)
      Rectangle().fill(Color.secondary.opacity(0.15)).frame(width: 1)
      VStack(alignment: .leading, spacing: 7) {
        HStack(spacing: 10) {
          Label(L(i, "sessions", f.sessions), systemImage: "checkmark.circle.fill").foregroundStyle(calm)
          Spacer(minLength: 0)
        }
        .font(.system(size: 11.5, weight: .semibold))
        Label(f.away == 0 ? L(i, "noAway") : L(i, "away", f.away), systemImage: f.away == 0 ? "sparkles" : "arrow.uturn.left")
          .font(.system(size: 11.5, weight: .medium))
          .foregroundStyle(.secondary)
        Columns(values: Array((Array(repeating: 0, count: 7) + f.week).suffix(7)), labels: weekdays(i), colors: [calm, calm2])
      }
      .labelStyle(Tight())
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct Tight: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    HStack(spacing: 5) { configuration.icon; configuration.title }.lineLimit(1)
  }
}

struct FocusView: View {
  @Environment(\.widgetFamily) var family
  let entry: Entry
  var body: some View {
    if family == .systemSmall {
      if let (s, e) = entry.info.running, e > entry.date { FocusRunning(i: entry.info, start: s, end: e) } else { FocusIdle(i: entry.info) }
    } else {
      FocusMedium(i: entry.info)
    }
  }
}

/* ---------------- words ---------------- */

// the translation stays blurred, like the back of a flash card: a tap opens the cards
struct Veiled: View {
  let text: String
  var size: CGFloat = 13
  var body: some View {
    Text(text)
      .font(.system(size: size, weight: .medium))
      .foregroundStyle(.secondary)
      .lineLimit(1)
      .blur(radius: 4.5)
      .padding(.horizontal, 2)
  }
}

struct WordsSmall: View {
  let i: Info
  let slot: Int
  var body: some View {
    let list = i.dueWords
    VStack(alignment: .leading, spacing: 6) {
      Head(icon: "character.book.closed.fill", text: L(i, "words"), tint: orange)
      Spacer(minLength: 0)
      if list.isEmpty {
        Image(systemName: "checkmark.seal.fill").font(.system(size: 26)).foregroundStyle(leaf)
        Text(L(i, "noDue")).font(.system(size: 13, weight: .semibold)).lineLimit(2)
        if let n = i.vocab { Text(L(i, "saved", n)).font(.system(size: 11)).foregroundStyle(.secondary) }
      } else {
        let w = list[slot % list.count]
        Text(w.w).font(.system(size: 24, weight: .semibold, design: .serif)).lineLimit(2).minimumScaleFactor(0.6)
        Veiled(text: w.tr)
        Spacer(minLength: 0)
        Text(L(i, "due", i.due)).font(.system(size: 11, weight: .semibold)).foregroundStyle(orange).lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct WordsMedium: View {
  let i: Info
  let slot: Int
  var body: some View {
    let list = i.dueWords
    if list.isEmpty {
      HStack(spacing: 14) {
        WordsSmall(i: i, slot: 0)
      }
    } else {
      let first = slot % list.count
      let rows = (0..<min(4, list.count)).map { list[(first + $0) % list.count] }
      VStack(alignment: .leading, spacing: 7) {
        HStack {
          Head(icon: "character.book.closed.fill", text: L(i, "words"), tint: orange)
          Spacer()
          Text(L(i, "due", i.due)).font(.system(size: 10.5, weight: .semibold)).foregroundStyle(orange)
        }
        ForEach(Array(rows.enumerated()), id: \.offset) { k, w in
          HStack(alignment: .firstTextBaseline) {
            Text(w.w).font(.system(size: k == 0 ? 17 : 14, weight: k == 0 ? .semibold : .medium, design: .serif)).lineLimit(1)
            Spacer(minLength: 10)
            Veiled(text: w.tr, size: k == 0 ? 13 : 12)
          }
          if k < rows.count - 1 { Rectangle().fill(Color.secondary.opacity(0.12)).frame(height: 1) }
        }
        Spacer(minLength: 0)
      }
    }
  }
}

struct WordsView: View {
  @Environment(\.widgetFamily) var family
  let entry: Entry
  var body: some View {
    if family == .systemSmall { WordsSmall(i: entry.info, slot: entry.slot) } else { WordsMedium(i: entry.info, slot: entry.slot) }
  }
}

/* ---------------- daily goal ---------------- */

struct GoalRing: View {
  let i: Info
  var size: CGFloat = 92
  var body: some View {
    let p = Double(i.todayMin) / Double(i.goalMin)
    ZStack {
      Ring(p: p, colors: [leaf2, leaf], width: size * 0.11)
      VStack(spacing: -2) {
        if p >= 1 {
          Image(systemName: "checkmark").font(.system(size: size * 0.24, weight: .bold)).foregroundStyle(leaf)
        } else {
          Text("\(i.todayMin)").font(.system(size: size * 0.3, weight: .bold, design: .rounded)).monospacedDigit()
        }
        Text(L(i, "of", i.goalMin)).font(.system(size: size * 0.12, weight: .medium)).foregroundStyle(.secondary)
      }
    }
    .frame(width: size, height: size)
  }
}

struct GoalSmall: View {
  let i: Info
  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Head(icon: "target", text: L(i, "goal"), tint: leaf)
        Spacer()
      }
      GoalRing(i: i, size: 86)
      Text(i.todayMin >= i.goalMin ? L(i, "goalDone") : L(i, "goalLeft", i.goalMin - i.todayMin))
        .font(.system(size: 11.5, weight: .semibold))
        .foregroundStyle(i.todayMin >= i.goalMin ? AnyShapeStyle(leaf) : AnyShapeStyle(.secondary))
        .lineLimit(1)
    }
  }
}

struct GoalMedium: View {
  let i: Info
  var body: some View {
    let mins = Array((Array(repeating: 0, count: 7) + (i.mins ?? [])).suffix(7))
    HStack(spacing: 16) {
      GoalSmall(i: i).frame(width: 132)
      VStack(alignment: .leading, spacing: 8) {
        Text(L(i, "weekTot", mins.reduce(0, +))).font(.system(size: 11.5, weight: .semibold)).foregroundStyle(.secondary).lineLimit(1)
        Columns(values: mins, labels: weekdays(i), colors: [leaf, leaf2])
      }
      .frame(maxWidth: .infinity)
    }
  }
}

struct GoalView: View {
  @Environment(\.widgetFamily) var family
  let entry: Entry
  var body: some View {
    if family == .systemSmall { GoalSmall(i: entry.info) } else { GoalMedium(i: entry.info) }
  }
}

/* ---------------- the article being read ---------------- */

struct ArticleSmall: View {
  let i: Info
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Head(icon: "book.fill", text: i.pct != nil && i.pct! > 0 ? L(i, "cont") : L(i, "start"), tint: orange)
      Spacer(minLength: 0)
      Text(i.title ?? L(i, "noArt")).font(.system(size: 15, weight: .semibold, design: .serif)).lineLimit(4).minimumScaleFactor(0.8)
      Spacer(minLength: 0)
      if let p = i.pct, p > 0 {
        HStack(spacing: 6) {
          Bar(p: Double(p) / 100, tint: AnyShapeStyle(fire), h: 5)
          Text("\(p)%").font(.system(size: 11, weight: .bold, design: .rounded)).monospacedDigit()
        }
      }
      if let l = i.left, l > 0 { Text(L(i, "left", l)).font(.system(size: 11)).foregroundStyle(.secondary).lineLimit(1) }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
  }
}

struct ArticleMedium: View {
  let i: Info
  var body: some View {
    HStack(spacing: 16) {
      ZStack {
        Ring(p: Double(i.pct ?? 0) / 100, colors: [amber, orange], width: 9)
        Text("\(i.pct ?? 0)%").font(.system(size: 18, weight: .bold, design: .rounded)).monospacedDigit()
      }
      .frame(width: 86, height: 86)
      VStack(alignment: .leading, spacing: 6) {
        Head(icon: "book.fill", text: i.pct != nil && i.pct! > 0 ? L(i, "cont") : L(i, "start"), tint: orange)
        Text(i.title ?? L(i, "noArt")).font(.system(size: 16, weight: .semibold, design: .serif)).lineLimit(3)
        Spacer(minLength: 0)
        HStack(spacing: 12) {
          if let l = i.left, l > 0 { Label(L(i, "left", l), systemImage: "clock") }
          if i.due > 0 { Label("\(i.due)", systemImage: "character.book.closed") }
        }
        .labelStyle(Tight())
        .font(.system(size: 11, weight: .medium))
        .foregroundStyle(.secondary)
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

struct ArticleView: View {
  @Environment(\.widgetFamily) var family
  let entry: Entry
  var body: some View {
    if family == .systemSmall { ArticleSmall(i: entry.info) } else { ArticleMedium(i: entry.info) }
  }
}

/* ---------------- the widgets ---------------- */

extension View {
  func card(_ url: URL) -> some View {
    containerBackground(.background, for: .widget).widgetURL(url)
  }
}

struct StreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "streak", provider: Provider()) { e in StreakView(entry: e).card(link(e.info.id.map { "article/\($0)" } ?? "open")) }
      .configurationDisplayName("Inkwell")
      .description("Streak, words to review and the article you're reading.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

struct FocusWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "focus", provider: Provider()) { e in FocusView(entry: e).card(link("focus")) }
      .configurationDisplayName("Focus")
      .description("A live countdown while you focus, and today's focused minutes.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct WordsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "words", provider: Provider(rotate: true)) { e in WordsView(entry: e).card(link("cards")) }
      .configurationDisplayName("Words to review")
      .description("A new word every 20 minutes; the translation stays hidden until you open it.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct GoalWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "goal", provider: Provider()) { e in GoalView(entry: e).card(link(e.info.id.map { "article/\($0)" } ?? "open")) }
      .configurationDisplayName("Daily goal")
      .description("Today's reading minutes against your goal, and the week.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct ArticleWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "article", provider: Provider()) { e in ArticleView(entry: e).card(link(e.info.id.map { "article/\($0)" } ?? "open")) }
      .configurationDisplayName("Continue reading")
      .description("The article you're in the middle of.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

#if PREVIEW
// scripts/preview-widget.sh: draws every widget into PNGs to check them without the desktop
@main
struct Preview {
  @MainActor static func main() {
    let out = CommandLine.arguments.dropFirst().first ?? "."
    var run = sample
    run.focus?.start = Date.now.addingTimeInterval(-600).timeIntervalSince1970 * 1000
    run.focus?.ends = Date.now.addingTimeInterval(900).timeIntervalSince1970 * 1000
    let sizes: [(String, CGSize)] = [("S", CGSize(width: 170, height: 170)), ("M", CGSize(width: 364, height: 170)), ("L", CGSize(width: 364, height: 382))]
    let views: [(String, Bool, Bool, (Bool) -> AnyView)] = [
      ("streak", true, true, { w in AnyView(w ? AnyView(StreakMedium(i: sample)) : AnyView(StreakSmall(i: sample))) }),
      ("streakL", false, false, { _ in AnyView(StreakLarge(i: sample)) }),
      ("focus", true, true, { w in AnyView(w ? AnyView(FocusMedium(i: sample)) : AnyView(FocusIdle(i: sample))) }),
      ("focusRun", true, true, { w in AnyView(w ? AnyView(FocusMedium(i: run)) : AnyView(FocusRunning(i: run, start: run.running!.0, end: run.running!.1))) }),
      ("words", true, true, { w in AnyView(w ? AnyView(WordsMedium(i: sample, slot: 0)) : AnyView(WordsSmall(i: sample, slot: 1))) }),
      ("goal", true, true, { w in AnyView(w ? AnyView(GoalMedium(i: sample)) : AnyView(GoalSmall(i: sample))) }),
      ("article", true, true, { w in AnyView(w ? AnyView(ArticleMedium(i: sample)) : AnyView(ArticleSmall(i: sample))) }),
    ]
    for scheme in [ColorScheme.light, .dark] {
      for (name, small, medium, make) in views {
        for (s, size) in sizes {
          if s == "S" && !small || s == "M" && !medium || s == "L" && name != "streakL" { continue }
          let v = make(s != "S")
            .padding(16)
            .frame(width: size.width, height: size.height)
            .background(scheme == .dark ? Color(white: 0.12) : .white)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .environment(\.colorScheme, scheme)
          let r = ImageRenderer(content: v)
          r.scale = 2
          if let img = r.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) {
            try? png.write(to: URL(fileURLWithPath: "\(out)/\(name)-\(s)-\(scheme == .dark ? "dark" : "light").png"))
          }
        }
      }
    }
  }
}
#else
@main
struct Widgets: WidgetBundle {
  var body: some Widget {
    StreakWidget()
    FocusWidget()
    WordsWidget()
    GoalWidget()
    ArticleWidget()
  }
}
#endif
