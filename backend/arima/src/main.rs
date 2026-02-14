use clap::Parser;
use dialoguer::{Confirm, FuzzySelect, Input, Select};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Parser, Debug, Clone)]
#[command(author, version, about)]
struct Args {
    #[arg(long, default_value = "Rscript")]
    rscript: String,

    #[arg(long, default_value = "datasus_export_tabnet_csv.R")]
    rfile: String,

    #[arg(long, default_value = "python")]
    python: String,

    #[arg(long, default_value = "ccnt2.py")]
    pyfile: String,

    #[arg(long, default_value = "resultados")]
    out_dir: String,
}

#[derive(Clone, Copy)]
struct Disease {
    label: &'static str,
    slug: &'static str,
    icd_prefix: &'static str,
}

#[derive(Clone, Copy)]
struct AnalysisType {
    label: &'static str,
    system: &'static str,
    slug: &'static str,
}

#[derive(Clone, Copy)]
struct Granularity {
    label: &'static str,
    value: &'static str, // "year" | "month"
    slug: &'static str,  // "anual" | "mensal"
}

struct Selection {
    uf_sigla: String,
    uf_cod: String,
    uf_nome: String,
    analysis: AnalysisType,
    disease: Disease,
    granularity: Granularity,
    year_start: i32,
    year_end: i32,
    month_start: i32,
    month_end: i32,
    anos_prev: i32,
    alpha: f64,
    out_folder: PathBuf,

    // arquivos principais (dependem da granularidade)
    out_csv: PathBuf,
    out_clean: PathBuf,

    // saídas python
    out_json: PathBuf,

    // para fallback (se mensal falhar no python)
    out_csv_anual: PathBuf,
    out_clean_anual: PathBuf,
    out_json_anual: PathBuf,
    out_json_mensal: PathBuf,
}

fn ensure_file_exists(p: &str, label: &str) {
    if !Path::new(p).exists() {
        eprintln!("[ERRO] {} não encontrado: {}", label, p);
        std::process::exit(10);
    }
}

fn sanitize_component(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if ch == ' ' || ch == '-' || ch == '_' {
            if !out.ends_with('_') {
                out.push('_');
            }
        }
    }
    out.trim_matches('_').to_string()
}

fn civil_from_days(days_since_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let mut y = (yoe + era * 400) as i32;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (mp + if mp < 10 { 3 } else { -9 }) as i32;
    y += if m <= 2 { 1 } else { 0 };
    (y, m as u32, d)
}

fn today_ddmmyyyy_tz_minus3() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    let local = now - 3 * 3600;
    let days = local.div_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    format!("{:02}-{:02}-{:04}", d, m, y)
}

fn uf_list() -> Vec<(String, String, String)> {
    vec![
        ("AC", "12", "Acre"),
        ("AL", "27", "Alagoas"),
        ("AP", "16", "Amapá"),
        ("AM", "13", "Amazonas"),
        ("BA", "29", "Bahia"),
        ("CE", "23", "Ceará"),
        ("DF", "53", "Distrito Federal"),
        ("ES", "32", "Espírito Santo"),
        ("GO", "52", "Goiás"),
        ("MA", "21", "Maranhão"),
        ("MT", "51", "Mato Grosso"),
        ("MS", "50", "Mato Grosso do Sul"),
        ("MG", "31", "Minas Gerais"),
        ("PA", "15", "Pará"),
        ("PB", "25", "Paraíba"),
        ("PR", "41", "Paraná"),
        ("PE", "26", "Pernambuco"),
        ("PI", "22", "Piauí"),
        ("RJ", "33", "Rio de Janeiro"),
        ("RN", "24", "Rio Grande do Norte"),
        ("RS", "43", "Rio Grande do Sul"),
        ("RO", "11", "Rondônia"),
        ("RR", "14", "Roraima"),
        ("SC", "42", "Santa Catarina"),
        ("SP", "35", "São Paulo"),
        ("SE", "28", "Sergipe"),
        ("TO", "17", "Tocantins"),
    ]
    .into_iter()
    .map(|(a, b, c)| (a.to_string(), b.to_string(), c.to_string()))
    .collect()
}

fn analysis_types() -> Vec<AnalysisType> {
    vec![
        AnalysisType { label: "Óbitos (SIM-DO)", system: "SIM-DO", slug: "obitos" },
        AnalysisType { label: "Óbitos (SIM-DO-PRELIM)", system: "SIM-DO-PRELIM", slug: "obitos_prelim" },
        AnalysisType { label: "Internações (SIH-RD)", system: "SIH-RD", slug: "internacoes" },
    ]
}

fn granularities() -> Vec<Granularity> {
    vec![
        Granularity { label: "Anual (por ano)", value: "year", slug: "anual" },
        Granularity { label: "Mensal (por mês)", value: "month", slug: "mensal" },
    ]
}

fn diseases() -> Vec<Disease> {
    vec![
        Disease { label: "Doenças cardiovasculares (CID-10: I)", slug: "cardiovasculares", icd_prefix: "I" },
        Disease { label: "Diabetes mellitus (E10-E14)", slug: "diabetes", icd_prefix: "E10,E11,E12,E13,E14" },
        Disease { label: "Doenças respiratórias crônicas (J40-J47,J45-J46)", slug: "respiratorias_cronicas", icd_prefix: "J40,J41,J42,J43,J44,J45,J46,J47" },
        Disease { label: "Neoplasias / Câncer (C e D0-D4)", slug: "cancer", icd_prefix: "C,D0,D1,D2,D3,D4" },
        Disease { label: "Hipertensão e doenças hipertensivas (I10-I15)", slug: "hipertensao", icd_prefix: "I10,I11,I12,I13,I14,I15" },
        Disease { label: "Doença renal crônica (N18-N19)", slug: "doenca_renal_cronica", icd_prefix: "N18,N19" },
    ]
}

fn ask_i32(prompt: &str, min: i32, max: i32, default: Option<i32>) -> i32 {
    let mut inp = Input::<i32>::new()
        .with_prompt(prompt)
        .validate_with(move |v: &i32| {
            if *v >= min && *v <= max { Ok(()) }
            else { Err(format!("Valor inválido. Use entre {} e {}.", min, max)) }
        });

    if let Some(d) = default {
        inp = inp.default(d);
    }
    inp.interact_text().unwrap()
}

fn ask_f64(prompt: &str, min: f64, max: f64, default: f64) -> f64 {
    Input::<f64>::new()
        .with_prompt(prompt)
        .default(default)
        .validate_with(move |v: &f64| {
            if *v >= min && *v <= max { Ok(()) }
            else { Err(format!("Valor inválido. Use entre {} e {}.", min, max)) }
        })
        .interact_text()
        .unwrap()
}

fn unique_folder(mut base: PathBuf) -> PathBuf {
    if !base.exists() { return base; }
    for i in 2..=999 {
        let candidate = PathBuf::from(format!("{}_{}", base.to_string_lossy(), i));
        if !candidate.exists() { return candidate; }
    }
    base
}

fn build_selection(args: &Args) -> Selection {
    let ufs = uf_list();
    let uf_items: Vec<String> = ufs.iter()
        .map(|(sigla, cod, nome)| format!("{} - {} ({})", sigla, nome, cod))
        .collect();
    let uf_idx = FuzzySelect::new()
        .with_prompt("Selecione a UF")
        .items(&uf_items)
        .interact()
        .unwrap();
    let (uf_sigla, uf_cod, uf_nome) = ufs[uf_idx].clone();

    let analyses = analysis_types();
    let analysis_items: Vec<&str> = analyses.iter().map(|a| a.label).collect();
    let analysis_idx = Select::new()
        .with_prompt("Tipo de análise")
        .items(&analysis_items)
        .interact()
        .unwrap();
    let analysis = analyses[analysis_idx];

    let grans = granularities();
    let gran_items: Vec<&str> = grans.iter().map(|g| g.label).collect();
    let gran_idx = Select::new()
        .with_prompt("Granularidade dos dados")
        .items(&gran_items)
        .interact()
        .unwrap();
    let granularity = grans[gran_idx];

    let ds = diseases();
    let disease_items: Vec<&str> = ds.iter().map(|d| d.label).collect();
    let disease_idx = FuzzySelect::new()
        .with_prompt("Selecione a DCNT")
        .items(&disease_items)
        .interact()
        .unwrap();
    let disease = ds[disease_idx];

    let year_start = ask_i32("Ano inicial", 1900, 2100, Some(2016));
    let year_end = ask_i32("Ano final", 1900, 2100, Some(2019));
    if year_end < year_start {
        eprintln!("[ERRO] Ano final não pode ser menor que o ano inicial.");
        std::process::exit(11);
    }

    let (month_start, month_end) = if granularity.value == "month" {
        let ms = ask_i32("Mês inicial (1-12)", 1, 12, Some(1));
        let me = ask_i32("Mês final (1-12)", 1, 12, Some(12));
        if me < ms {
            eprintln!("[ERRO] Mês final não pode ser menor que o mês inicial.");
            std::process::exit(12);
        }
        (ms, me)
    } else {
        (1, 12)
    };

    let anos_prev = ask_i32("Anos de previsão (ARIMA)", 1, 20, Some(3));
    let alpha = ask_f64("Alpha (ex.: 0.95)", 0.50, 0.999, 0.95);

    let date = today_ddmmyyyy_tz_minus3();
    let folder = format!(
        "{}-{}-{}",
        date,
        sanitize_component(disease.slug),
        analysis.slug
    );
    let out_folder = unique_folder(Path::new(&args.out_dir).join(folder));

    let out_csv = if granularity.value == "month" {
        out_folder.join("dados_tabnet_mensal.csv")
    } else {
        out_folder.join("dados_tabnet.csv")
    };

    let out_clean = if granularity.value == "month" {
        out_folder.join("dados_limpos_mensal.csv")
    } else {
        out_folder.join("dados_limpos.csv")
    };

    let out_json = if granularity.value == "month" {
        out_folder.join("saida_previsao_mensal.json")
    } else {
        out_folder.join("saida_previsao.json")
    };

    let out_csv_anual = out_folder.join("dados_tabnet_anual.csv");
    let out_clean_anual = out_folder.join("dados_limpos_anual.csv");
    let out_json_anual = out_folder.join("saida_previsao_anual.json");
    let out_json_mensal = out_folder.join("saida_previsao_mensal.json");

    Selection {
        uf_sigla, uf_cod, uf_nome,
        analysis, disease, granularity,
        year_start, year_end,
        month_start, month_end,
        anos_prev, alpha,
        out_folder,
        out_csv, out_clean,
        out_json,
        out_csv_anual, out_clean_anual,
        out_json_anual, out_json_mensal,
    }
}

fn cmd_to_string(cmd: &Command) -> String {
    let mut s = String::new();
    s.push_str(&cmd.get_program().to_string_lossy());
    for a in cmd.get_args() {
        let a = a.to_string_lossy();
        if a.contains(' ') {
            s.push_str(" \"");
            s.push_str(&a);
            s.push('"');
        } else {
            s.push(' ');
            s.push_str(&a);
        }
    }
    s
}

fn run_r(args: &Args, sel: &Selection, granularity: &str, month_start: i32, month_end: i32, out_csv: &Path, out_clean: &Path) {
    ensure_file_exists(&args.rfile, "Script R");
    fs::create_dir_all(&sel.out_folder).expect("Falha ao criar pasta de saída");

    let mut cmd = Command::new(&args.rscript);
    cmd.arg("--vanilla")
        .arg(&args.rfile)
        .arg("--system").arg(sel.analysis.system)
        .arg("--uf").arg(&sel.uf_sigla)
        .arg("--year-start").arg(sel.year_start.to_string())
        .arg("--year-end").arg(sel.year_end.to_string())
        .arg("--granularity").arg(granularity)
        .arg("--icd-prefix").arg(sel.disease.icd_prefix)
        .arg("--out").arg(out_csv.to_string_lossy().to_string())
        .arg("--out-clean").arg(out_clean.to_string_lossy().to_string());

    if granularity == "month" {
        cmd.arg("--month-start").arg(month_start.to_string())
           .arg("--month-end").arg(month_end.to_string());
    }

    println!("\n[R] {}", cmd_to_string(&cmd));
    let status = cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit())
        .status().expect("Falha ao executar Rscript");

    if !status.success() {
        eprintln!("[ERRO] Rscript falhou.");
        std::process::exit(2);
    }
}

fn run_python(args: &Args, sel: &Selection, csv: &Path, out_json: &Path) -> bool {
    ensure_file_exists(&args.pyfile, "Script Python");

    let mut cmd = Command::new(&args.python);
    cmd.arg(&args.pyfile)
        .arg("--csv").arg(csv.to_string_lossy().to_string())
        .arg("--estado").arg(&sel.uf_cod)
        .arg("--anos-prev").arg(sel.anos_prev.to_string())
        .arg("--alpha").arg(sel.alpha.to_string())
        .arg("--saida").arg(out_json.to_string_lossy().to_string())
        .arg("--pretty");

    println!("\n[PY] {}", cmd_to_string(&cmd));
    let status = cmd.stdout(Stdio::inherit()).stderr(Stdio::inherit())
        .status().expect("Falha ao executar Python");

    status.success()
}

fn print_summary(sel: &Selection) {
    println!("\n================ RESUMO ================");
    println!("UF: {} ({}) - {}", sel.uf_sigla, sel.uf_cod, sel.uf_nome);
    println!("Tipo: {}", sel.analysis.label);
    println!("DCNT: {}", sel.disease.label);
    println!("Período: {}-{}", sel.year_start, sel.year_end);
    println!("Granularidade: {}", sel.granularity.label);
    if sel.granularity.value == "month" {
        println!("Meses: {}-{}", sel.month_start, sel.month_end);
    }
    println!("ARIMA (Python): {} anos | alpha={}", sel.anos_prev, sel.alpha);
    println!("Pasta de saída: {}", sel.out_folder.to_string_lossy());
    println!("=======================================\n");
}

fn main_menu(args: Args) {
    ensure_file_exists(&args.rfile, "Script R");
    ensure_file_exists(&args.pyfile, "Script Python");

    println!("\nDATASUS → Rust → Python (ARIMA)");
    println!("- Você escolhe UF, tipo, DCNT, período e granularidade (anual/mensal).");
    println!("- A saída é salva automaticamente em: {}\n", args.out_dir);

    loop {
        let sel = build_selection(&args);
        print_summary(&sel);

        let go = Confirm::new()
            .with_prompt("Executar esta análise agora?")
            .default(true)
            .interact()
            .unwrap();
        if !go {
            let again = Confirm::new().with_prompt("Voltar ao menu?").default(true).interact().unwrap();
            if !again { break; }
            continue;
        }

        // 1) Exporta dados na granularidade escolhida
        run_r(
            &args,
            &sel,
            sel.granularity.value,
            sel.month_start,
            sel.month_end,
            &sel.out_csv,
            &sel.out_clean,
        );

        // 2) Roda Python
        if sel.granularity.value == "month" {
            // tenta mensal primeiro
            let ok_mensal = run_python(&args, &sel, &sel.out_csv, &sel.out_json_mensal);

            if ok_mensal {
                println!("\n[OK] ARIMA rodou em dados MENSAIS.");
                println!("CSV mensal: {}", sel.out_csv.to_string_lossy());
                println!("JSON:       {}", sel.out_json_mensal.to_string_lossy());
            } else {
                eprintln!("\n[AVISO] ccnt2.py falhou com dados mensais.");
                eprintln!("[AVISO] Fazendo fallback automático: export ANUAL e roda ARIMA ANUAL (sem alterar ccnt2.py).");

                run_r(
                    &args,
                    &sel,
                    "year",
                    1,
                    12,
                    &sel.out_csv_anual,
                    &sel.out_clean_anual,
                );

                let ok_anual = run_python(&args, &sel, &sel.out_csv_anual, &sel.out_json_anual);
                if !ok_anual {
                    eprintln!("[ERRO] Python falhou também no fallback anual.");
                    std::process::exit(3);
                }
                println!("\n[OK] ARIMA rodou em dados ANUAIS (fallback).");
                println!("CSV anual: {}", sel.out_csv_anual.to_string_lossy());
                println!("JSON:      {}", sel.out_json_anual.to_string_lossy());
            }
        } else {
            let ok = run_python(&args, &sel, &sel.out_csv, &sel.out_json);
            if !ok {
                eprintln!("[ERRO] Python falhou.");
                std::process::exit(3);
            }
            println!("\n[OK] Concluído!");
            println!("CSV:  {}", sel.out_csv.to_string_lossy());
            println!("JSON: {}", sel.out_json.to_string_lossy());
        }

        let again = Confirm::new().with_prompt("Rodar outra análise?").default(true).interact().unwrap();
        if !again { break; }
    }
}

fn main() {
    let args = Args::parse();
    main_menu(args);
}
