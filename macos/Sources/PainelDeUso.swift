// Janela de ajustes do painel-de-uso, para macOS 26 (Liquid Glass).
//
// O mod abre este app com `--estado '<json>'` ({ prefs, amostra }) e escuta a saída padrão:
//   {"pronto":true}            assim que a janela aparece
//   {"prefs":{...}}            a cada mudança
//   {"fim":true}               ao fechar
// Nada mais sai daqui: o app não usa rede nem grava arquivos.
import AppKit
import SwiftUI

// MARK: - Modelo

enum Idioma: String, CaseIterable, Identifiable { case en, pt; var id: String { rawValue } }
enum Moeda: String, CaseIterable, Identifiable { case USD, BRL, EUR; var id: String { rawValue } }
enum Mascote: String, CaseIterable, Identifiable { case animado, parado, oculto; var id: String { rawValue } }

struct Amostra {
    var modelo = "Opus 5.5"
    var usd = 3.26
    var contexto = 24.0
    var cincoHoras = 5.0
    var semana = 1.0
    var porModelo: [(modelo: String, pct: Double)] = [("Fable", 0)]
    var taxas: [String: Double] = [:]
}

@MainActor
final class Ajustes: ObservableObject {
    @Published var idioma: Idioma = .en { didSet { avisar() } }
    @Published var moeda: Moeda = .USD { didSet { avisar() } }
    @Published var mascote: Mascote = .animado { didSet { avisar() } }
    @Published var limitePorModelo = true { didSet { avisar() } }
    var amostra = Amostra()
    private var pronto = false

    init(argumentos: [String]) {
        guard let i = argumentos.firstIndex(of: "--estado"), i + 1 < argumentos.count,
              let dados = argumentos[i + 1].data(using: .utf8),
              let raiz = try? JSONSerialization.jsonObject(with: dados) as? [String: Any] else { pronto = true; return }
        if let p = raiz["prefs"] as? [String: Any] {
            idioma = Idioma(rawValue: p["idioma"] as? String ?? "") ?? .en
            moeda = Moeda(rawValue: p["moeda"] as? String ?? "") ?? .USD
            mascote = Mascote(rawValue: p["mascote"] as? String ?? "") ?? .animado
            limitePorModelo = p["limitePorModelo"] as? Bool ?? true
        }
        if let a = raiz["amostra"] as? [String: Any] {
            amostra.modelo = a["modelo"] as? String ?? amostra.modelo
            amostra.usd = (a["usd"] as? NSNumber)?.doubleValue ?? amostra.usd
            amostra.contexto = (a["contexto"] as? NSNumber)?.doubleValue ?? amostra.contexto
            amostra.cincoHoras = (a["cincoHoras"] as? NSNumber)?.doubleValue ?? amostra.cincoHoras
            amostra.semana = (a["semana"] as? NSNumber)?.doubleValue ?? amostra.semana
            if let lista = a["porModelo"] as? [[String: Any]], !lista.isEmpty {
                amostra.porModelo = lista.compactMap { item in
                    guard let m = item["modelo"] as? String else { return nil }
                    return (m, (item["pct"] as? NSNumber)?.doubleValue ?? 0)
                }
            }
            if let t = a["taxas"] as? [String: Any] {
                amostra.taxas = t.compactMapValues { ($0 as? NSNumber)?.doubleValue }
            }
        }
        pronto = true
    }

    private func avisar() {
        guard pronto else { return }
        Saida.linha(["prefs": ["idioma": idioma.rawValue, "moeda": moeda.rawValue, "mascote": mascote.rawValue, "limitePorModelo": limitePorModelo]])
    }

    var t: Textos { Textos(idioma) }

    // Mesmo formato da banda: dólar sem conversão; o resto pela taxa e com "≈".
    func custo() -> String {
        let pt = idioma == .pt
        func numero(_ v: Double, _ casas: Int) -> String {
            let f = NumberFormatter()
            f.numberStyle = .decimal
            f.minimumFractionDigits = casas
            f.maximumFractionDigits = casas
            f.locale = Locale(identifier: pt ? "pt_BR" : "en_US")
            return f.string(from: NSNumber(value: v)) ?? String(v)
        }
        let dolar = (pt ? "US$ " : "$") + numero(amostra.usd, 2)
        guard moeda != .USD else { return dolar }
        guard let taxa = amostra.taxas[moeda.rawValue] ?? Self.taxaDeExemplo[moeda] else { return dolar }
        let simbolo: String
        switch moeda {
        case .BRL: simbolo = pt ? "R$ " : "R$"
        case .EUR: simbolo = pt ? "€ " : "€"
        case .USD: simbolo = ""
        }
        return "≈ " + simbolo + numero(amostra.usd * taxa, 2)
    }

    // Só para a prévia, quando o mod ainda não leu o câmbio.
    static let taxaDeExemplo: [Moeda: Double] = [.BRL: 5.4, .EUR: 0.92]
}

enum Saida {
    static func linha(_ objeto: [String: Any]) {
        guard let dados = try? JSONSerialization.data(withJSONObject: objeto, options: [.sortedKeys]),
              let texto = String(data: dados, encoding: .utf8) else { return }
        FileHandle.standardOutput.write(Data((texto + "\n").utf8))
    }
}

struct Textos {
    let pt: Bool
    init(_ i: Idioma) { pt = i == .pt }
    var titulo: String { pt ? "Painel de uso" : "Usage band" }
    var subtitulo: String { pt ? "Ajustes da banda acima do prompt" : "Settings for the band above the prompt" }
    var previa: String { pt ? "Prévia" : "Preview" }
    var idioma: String { pt ? "Idioma" : "Language" }
    var moeda: String { pt ? "Moeda do custo" : "Cost currency" }
    var moedaNota: String { pt ? "Dólar não usa rede; as outras moedas usam as taxas da Coinbase." : "Dollars need no network; other currencies use Coinbase rates." }
    var mascote: String { pt ? "Mascote" : "Mascot" }
    var animado: String { pt ? "Animado" : "Animated" }
    var parado: String { pt ? "Parado" : "Still" }
    var oculto: String { pt ? "Oculto" : "Hidden" }
    var porModelo: String { pt ? "Limite semanal por modelo" : "Per-model weekly limit" }
    var porModeloNota: String { pt ? "Usa um endpoint interno da Anthropic, que pode mudar sem aviso." : "Uses an internal Anthropic endpoint that may change without notice." }
    var contexto: String { pt ? "Contexto" : "Context" }
    var pronto: String { pt ? "Pronto" : "Done" }
    var rodape: String { pt ? "As mudanças valem na hora." : "Changes apply right away." }
}

// MARK: - Mascote em pixel

struct Clawd: View {
    let estilo: Mascote
    var tamanho: CGFloat = 4
    // Com "reduzir movimento" ligado no sistema, ou no estilo parado, nada se mexe nem redesenha.
    @Environment(\.accessibilityReduceMotion) private var reduzirMovimento

    // Corpo 16×10 do mascote do mod: linhas de cima para baixo.
    private static let corpo: [(Int, Int, Int, Int)] = [
        (2, 0, 12, 4), (0, 4, 16, 2), (2, 6, 12, 2),
        (3, 8, 1, 2), (5, 8, 1, 2), (10, 8, 1, 2), (12, 8, 1, 2),
    ]

    var body: some View {
        Group {
            if estilo == .animado && !reduzirMovimento {
                TimelineView(.periodic(from: .now, by: 0.12)) { contexto in
                    let ciclo = Int(contexto.date.timeIntervalSinceReferenceDate / 0.12) % 40
                    let pulo: CGFloat = (30...33).contains(ciclo) ? [-1, -2, -2, -1][ciclo - 30] : 0
                    desenho(piscando: ciclo == 0 || ciclo == 21, pulo: pulo)
                }
            } else {
                desenho(piscando: false, pulo: 0)
            }
        }
        .opacity(estilo == .oculto ? 0.25 : 1)
        .accessibilityLabel("Pixel crab mascot")
    }

    private func desenho(piscando: Bool, pulo: CGFloat) -> some View {
        Canvas { ctx, _ in
            let laranja = Color(red: 0xD8 / 255, green: 0x76 / 255, blue: 0x56 / 255)
            let olho = Color(red: 0x14 / 255, green: 0x14 / 255, blue: 0x13 / 255)
            let dy = (2 + pulo) * tamanho
            for (x, y, w, h) in Self.corpo {
                ctx.fill(Path(CGRect(x: CGFloat(x) * tamanho, y: CGFloat(y) * tamanho + dy, width: CGFloat(w) * tamanho, height: CGFloat(h) * tamanho)), with: .color(laranja))
            }
            for x in [4, 11] {
                let r = piscando
                    ? CGRect(x: CGFloat(x) * tamanho, y: 3 * tamanho + dy, width: tamanho, height: tamanho)
                    : CGRect(x: CGFloat(x) * tamanho, y: 2 * tamanho + dy, width: tamanho, height: 2 * tamanho)
                ctx.fill(Path(r), with: .color(olho))
            }
        }
        .frame(width: 16 * tamanho, height: 12 * tamanho)
    }
}

// Cor que muda com o tema: mais fechada no claro, mais aberta no escuro, para o texto colorido
// ter contraste de pelo menos 4,5:1 sobre o fundo nos dois.
func dinamica(claro: UInt32, escuro: UInt32) -> Color {
    func cor(_ hex: UInt32) -> NSColor {
        NSColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
    }
    return Color(nsColor: NSColor(name: nil) { aparencia in
        aparencia.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? cor(escuro) : cor(claro)
    })
}

enum Nivel {
    static let ok = dinamica(claro: 0x1E7B34, escuro: 0x5DD07A)
    static let atencao = dinamica(claro: 0x9A4F00, escuro: 0xFFB340)
    static let alto = dinamica(claro: 0xB3261E, escuro: 0xFF6B6B)
}

// MARK: - Prévia da banda

// Uma barra como a da banda: rótulo apagado, trilho cinza reto e preenchimento na cor do nível.
struct Barra: View {
    let rotulo: String
    let pct: Double

    private var cor: Color { pct >= 85 ? Nivel.alto : pct >= 60 ? Nivel.atencao : Nivel.ok }

    var body: some View {
        HStack(spacing: 4) {
            Text(rotulo).foregroundStyle(.secondary).lineLimit(1).fixedSize()
            ZStack(alignment: .leading) {
                Rectangle().fill(Color.primary.opacity(0.16))
                Rectangle().fill(cor).frame(width: 26 * min(1, max(0, pct) / 100))
            }
            .frame(width: 26, height: 5)
            Text("\(Int(pct.rounded()))%").monospacedDigit().foregroundStyle(cor).lineLimit(1).fixedSize()
        }
    }
}

// A banda em miniatura, numa linha só, como ela aparece acima do prompt.
struct PreviaDaBanda: View {
    @ObservedObject var a: Ajustes

    var body: some View {
        HStack(spacing: 9) {
            HStack(spacing: 4) {
                if a.mascote != .oculto { Clawd(estilo: a.mascote, tamanho: 1.1) }
                Text(a.amostra.modelo).fontWeight(.semibold).lineLimit(1).fixedSize()
                Text("· " + a.custo()).foregroundStyle(.secondary).lineLimit(1).fixedSize()
            }
            Barra(rotulo: a.t.contexto, pct: a.amostra.contexto)
            Barra(rotulo: "5h", pct: a.amostra.cincoHoras)
            Barra(rotulo: "7d", pct: a.amostra.semana)
            if a.limitePorModelo, let m = a.amostra.porModelo.first { Barra(rotulo: m.modelo, pct: m.pct) }
            HStack(spacing: 6) {
                Image(systemName: "gearshape.fill")
                Image(systemName: "xmark")
            }
            .foregroundStyle(.secondary)
            .imageScale(.small)
        }
        .font(.caption2)
        .fixedSize()
    }
}

// A prévia encolhida, sem quebrar a linha, até caber na largura da janela.
@MainActor
final class Medidas: ObservableObject {
    @Published var tamanho = CGSize(width: 1, height: 1)
    @Published var largura = CGFloat(1)
}

struct PreviaEncaixada: View {
    @ObservedObject var a: Ajustes
    @StateObject private var m = Medidas()

    var body: some View {
        let escala = min(1, m.largura / max(1, m.tamanho.width))
        let medidas = m
        Color.clear
            .frame(maxWidth: .infinity)
            .frame(height: m.tamanho.height * escala)
            .onGeometryChange(for: CGFloat.self) { proxy in proxy.size.width } action: { novo in medidas.largura = novo }
            .overlay(alignment: .leading) {
                PreviaDaBanda(a: a)
                    .onGeometryChange(for: CGSize.self) { proxy in proxy.size } action: { novo in medidas.tamanho = novo }
                    .scaleEffect(escala, anchor: .leading)
            }
    }
}

// MARK: - Janela

// Uma linha de ajuste no jeito do macOS: nome à esquerda, controle à direita, nota embaixo.
struct Linha<Controle: View>: View {
    let titulo: String
    var nota: String?
    @ViewBuilder var controle: Controle

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 12) {
                Text(titulo)
                Spacer(minLength: 8)
                controle
            }
            if let nota {
                Text(nota).font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
        }
        .padding(.vertical, 9)
        .padding(.horizontal, 14)
    }
}

struct AjustesView: View {
    @ObservedObject var a: Ajustes
    static let laranja = Color(red: 0xD8 / 255, green: 0x76 / 255, blue: 0x56 / 255)
    // Destaque dos controles com texto branco em cima: laranja mais fechado, contraste de 4,5:1.
    static let destaque = Color(red: 0xB8 / 255, green: 0x5C / 255, blue: 0x38 / 255)

    var body: some View {
        let t = a.t
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Clawd(estilo: a.mascote == .oculto ? .parado : a.mascote, tamanho: 2)
                    .padding(8)
                    .background(Self.laranja.opacity(0.14), in: .rect(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 1) {
                    Text(t.titulo).font(.headline)
                    Text(t.subtitulo).font(.callout).foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(t.previa.uppercased()).font(.caption2.weight(.semibold)).foregroundStyle(.secondary).tracking(0.6)
                PreviaEncaixada(a: a)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    // Fundo quase opaco, como o da banda de verdade: o vidro pode ficar cinza com uma
                    // janela escura atrás, e os percentuais coloridos precisam de um fundo estável.
                    .background(Color(nsColor: .textBackgroundColor).opacity(0.88), in: .rect(cornerRadius: 10))
            }

            VStack(spacing: 0) {
                Linha(titulo: t.idioma) {
                    Picker(t.idioma, selection: $a.idioma) {
                        Text("English").tag(Idioma.en)
                        Text("Português").tag(Idioma.pt)
                    }
                    .pickerStyle(.segmented).labelsHidden().fixedSize()
                }
                Divider().padding(.leading, 14)
                Linha(titulo: t.moeda, nota: t.moedaNota) {
                    Picker(t.moeda, selection: $a.moeda) {
                        Text("US$").tag(Moeda.USD)
                        Text("R$").tag(Moeda.BRL)
                        Text("€").tag(Moeda.EUR)
                    }
                    .pickerStyle(.segmented).labelsHidden().fixedSize()
                }
                Divider().padding(.leading, 14)
                Linha(titulo: t.mascote) {
                    Picker(t.mascote, selection: $a.mascote) {
                        Text(t.animado).tag(Mascote.animado)
                        Text(t.parado).tag(Mascote.parado)
                        Text(t.oculto).tag(Mascote.oculto)
                    }
                    .pickerStyle(.segmented).labelsHidden().fixedSize()
                }
                Divider().padding(.leading, 14)
                Linha(titulo: t.porModelo, nota: t.porModeloNota) {
                    Toggle(t.porModelo, isOn: $a.limitePorModelo).toggleStyle(.switch).labelsHidden().tint(Self.destaque).controlSize(.small)
                }
            }
            .background(.fill.quaternary, in: .rect(cornerRadius: 10))

            HStack {
                Text(t.rodape).font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button(t.pronto) { NSApp.keyWindow?.close() }
                    .buttonStyle(.glassProminent)
                    .tint(Self.destaque)
                    .keyboardShortcut(.defaultAction)
            }
        }
        .padding(.horizontal, 20)
        // A barra de título (28 pt, com os botões de fechar) já fica em cima; mais 12 pt dão 40 pt
        // do topo da janela até o cabeçalho, sem vão.
        .padding(.top, 12)
        .padding(.bottom, 20)
        .frame(width: 540)
        // Uma cor de destaque só, nos seletores, no interruptor e no botão.
        .tint(Self.destaque)
        // A janela inteira é uma placa de Liquid Glass; o que fica dentro dela não leva vidro de novo.
        // O fundo da janela inteira, faixa dos botões de fechar incluída.
        .containerBackground(for: .window) {
            Color.clear.glassEffect(.regular, in: .rect(cornerRadius: 24))
        }
        .background(JanelaTransparente())
        .onExitCommand { NSApp.keyWindow?.close() }
    }
}

// Deixa a janela sem fundo próprio, para o vidro mostrar o que está atrás.
struct JanelaTransparente: NSViewRepresentable {
    func makeNSView(context: Context) -> NSView {
        let v = NSView()
        DispatchQueue.main.async {
            guard let w = v.window else { return }
            w.isOpaque = false
            w.backgroundColor = .clear
            // O conteúdo ocupa também a faixa dos botões de fechar: a placa começa no topo.
            w.styleMask.insert(.fullSizeContentView)
            w.titlebarAppearsTransparent = true
            w.titleVisibility = .hidden
            w.hasShadow = true
            w.isMovableByWindowBackground = true
        }
        return v
    }

    func updateNSView(_ nsView: NSView, context: Context) {}
}

// Só para gerar imagens do README: `--print arquivo.png` espera a janela aparecer, desenha o
// conteúdo dela sobre um fundo de exemplo, grava o PNG e fecha. O vidro sai aproximado: o
// desfoque do que está atrás quem faz é o sistema, e ele fica fora desta foto.
enum Print {
    @MainActor
    static func agendar(destino: String, escuro: Bool) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            guard let w = NSApp.windows.first(where: { $0.isVisible }), let v = w.contentView else { exit(2) }
            let tam = v.bounds.size
            let margem: CGFloat = 56
            let escala: CGFloat = 2
            let largura = Int((tam.width + 2 * margem) * escala), altura = Int((tam.height + 2 * margem) * escala)
            guard let ctx = CGContext(data: nil, width: largura, height: altura, bitsPerComponent: 8, bytesPerRow: 0,
                                      space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { exit(3) }
            ctx.scaleBy(x: escala, y: escala)
            let cores = escuro
                ? [CGColor(red: 0.10, green: 0.12, blue: 0.22, alpha: 1), CGColor(red: 0.36, green: 0.17, blue: 0.25, alpha: 1), CGColor(red: 0.80, green: 0.42, blue: 0.29, alpha: 1)]
                : [CGColor(red: 0.62, green: 0.78, blue: 0.95, alpha: 1), CGColor(red: 0.93, green: 0.80, blue: 0.86, alpha: 1), CGColor(red: 0.99, green: 0.86, blue: 0.70, alpha: 1)]
            let grad = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: cores as CFArray, locations: [0, 0.55, 1])!
            ctx.drawLinearGradient(grad, start: .zero, end: CGPoint(x: tam.width + 2 * margem, y: tam.height + 2 * margem), options: [])
            ctx.translateBy(x: margem, y: margem)
            // O vidro de verdade é o sistema que desenha; aqui vai uma placa translúcida no lugar dele.
            let placa = CGPath(roundedRect: CGRect(origin: .zero, size: tam), cornerWidth: 28, cornerHeight: 28, transform: nil)
            ctx.saveGState()
            ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 40, color: CGColor(gray: 0, alpha: escuro ? 0.5 : 0.22))
            ctx.addPath(placa)
            ctx.setFillColor(escuro ? CGColor(gray: 0.12, alpha: 0.62) : CGColor(gray: 1, alpha: 0.5))
            ctx.fillPath()
            ctx.restoreGState()
            ctx.addPath(placa)
            ctx.setStrokeColor(CGColor(gray: 1, alpha: escuro ? 0.18 : 0.7))
            ctx.setLineWidth(1)
            ctx.strokePath()
            guard let rep0 = v.bitmapImageRepForCachingDisplay(in: v.bounds) else { exit(5) }
            v.cacheDisplay(in: v.bounds, to: rep0)
            if let foto = rep0.cgImage { ctx.draw(foto, in: CGRect(origin: .zero, size: tam)) }
            guard let img = ctx.makeImage() else { exit(4) }
            let rep = NSBitmapImageRep(cgImage: img)
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: destino))
            NSApp.terminate(nil)
        }
    }
}

// MARK: - App

final class Delegado: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.activate()
        Saida.linha(["pronto": true])
        let args = CommandLine.arguments
        if let i = args.firstIndex(of: "--print"), i + 1 < args.count {
            let escuro = args.contains("--escuro")
            NSApp.appearance = NSAppearance(named: escuro ? .darkAqua : .aqua)
            MainActor.assumeIsolated { Print.agendar(destino: args[i + 1], escuro: escuro) }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) { Saida.linha(["fim": true]) }
}

@main
struct PainelDeUsoApp: App {
    @NSApplicationDelegateAdaptor(Delegado.self) var delegado
    @StateObject private var ajustes = Ajustes(argumentos: CommandLine.arguments)

    var body: some Scene {
        Window("Painel de uso", id: "ajustes") {
            AjustesView(a: ajustes)
        }
        .windowStyle(.hiddenTitleBar)
        .windowResizability(.contentSize)
        .windowBackgroundDragBehavior(.enabled)
        .defaultPosition(.center)
    }
}
