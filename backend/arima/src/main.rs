use clap::Parser;
use dialoguer::{Confirm, FuzzySelect, Input, Select};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

/// Orquestrador: R (microdatasus) -> Rust (menu + execução) -> Python (ARIMA)
#[derive(Parser, Debug, Clone)]
#[command(author, version, about)]
struct Args {
    /// Comando do Rscript (precisa estar no PATH)
    #[arg(long, default_value = "Rscript")]
    rscript: String,

    /// Script R (microdatasus export)
    #[arg(long, default_value = "datasus_export_tabnet_csv.R")]
    rfile: String,

    /// Comando do Python (precisa estar no PATH)
    #[arg(long, default_value = "python")]
    python: String,

    /// Script Python (ARIMA)
    #[arg(long, default_value = "ccnt2.py")]
    pyfile: String,

    /// Pasta raiz onde as análises serão salvas
    #[arg(long, default_value = "resultados")]
    out_dir: String,
}

#[derive(Clone, Copy)]
struct Disease {
    label: &'static str,
    /// Nome curto para pasta
    slug: &'static str,
    /// Prefixos CID-10 (separados por vírgula) compatíveis com o filtro do script R
    icd_prefix: &'static str,
}

#[derive(Clone, Copy)]
struct AnalysisType {
    label: &'static str,
    /// Valor para --system no script R
    system: &'static str,
    /// Nome curto para pasta
    slug: &'static str,
}

struct Selection {
    uf_sigla: String,
    uf_cod: String,
    uf_nome: String,
    analysis: AnalysisType,
    disease: Disease,
    year_start: i32,
    year_end: i32,
    anos_prev: i32,
    alpha: f64,
    out_folder: PathBuf,
    out_csv: PathBuf,
    out_clean: PathBuf,
    out_json: PathBuf,
}

fn ensure_file_exists(p: &str, label: &str) {
    if !Path::new(p).exists() {
        eprintln!("[ERRO] {} não encontrado: {}", label, p);
        eprintln!(
            "Dica: execute o programa a partir da pasta do projeto, ou passe --{} com um caminho válido.",
            match label {
                "Script R" => "rfile",
                "Script Python" => "pyfile",
                _ => "",
            }
        );
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

/// Converte "dias desde 1970-01-01" em (ano, mês, dia) no calendário gregoriano.
fn civil_from_days(days_since_epoch: i64) -> (i32, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365; // [0, 399]
    let mut y = (yoe + era * 400) as i32;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153; // [0, 11]
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = (mp + if mp < 10 { 3 } else { -9 }) as i32;
    y += if m <= 2 { 1 } else { 0 };
    (y, m as u32, d)
}

fn today_ddmmyyyy_tz_minus3() -> String {
    // Fortaleza (BRT) ≈ UTC-03. Evita dependências extras.
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
        AnalysisType {
            label: "Óbitos (SIM-DO)",
            system: "SIM-DO",
            slug: "obitos",
        },
        AnalysisType {
            label: "Óbitos (SIM-DO-PRELIM)",
            system: "SIM-DO-PRELIM",
            slug: "obitos_prelim",
        },
        AnalysisType {
            label: "Internações (SIH-RD)",
            system: "SIH-RD",
            slug: "internacoes",
        },
    ]
}

fn diseases() -> Vec<Disease> {
    vec![
        Disease { label: "Doenças cardiovasculares (CID-10: I)", slug: "cardiovasculares", icd_prefix: "I" },
        Disease { label: "Doença isquêmica do coração (I20-I25)", slug: "isquemica_coracao", icd_prefix: "I20,I21,I22,I23,I24,I25" },
        Disease { label: "Doenças cerebrovasculares / AVC (I60-I69)", slug: "avc", icd_prefix: "I60,I61,I62,I63,I64,I65,I66,I67,I68,I69" },
        Disease { label: "Hipertensão e doenças hipertensivas (I10-I15)", slug: "hipertensao", icd_prefix: "I10,I11,I12,I13,I14,I15" },
        Disease { label: "Diabetes mellitus (E10-E14)", slug: "diabetes", icd_prefix: "E10,E11,E12,E13,E14" },
        Disease { label: "Doença renal crônica (N18-N19)", slug: "doenca_renal_cronica", icd_prefix: "N18,N19" },
        Disease { label: "Doenças respiratórias crônicas (J40-J47,J45-J46)", slug: "respiratorias_cronicas", icd_prefix: "J40,J41,J42,J43,J44,J45,J46,J47" },
        Disease { label: "DPOC (J40-J44)", slug: "dpoc", icd_prefix: "J40,J41,J42,J43,J44" },
        Disease { label: "Asma (J45-J46)", slug: "asma", icd_prefix: "J45,J46" },
        Disease { label: "Neoplasias / Câncer (C e D0-D4)", slug: "cancer", icd_prefix: "C,D0,D1,D2,D3,D4" },
        Disease { label: "Câncer de pulmão (C33-C34)", slug: "cancer_pulmao", icd_prefix: "C33,C34" },
        Disease { label: "Câncer de mama (C50)", slug: "cancer_mama", icd_prefix: "C50" },
        Disease { label: "Câncer colorretal (C18-C21)", slug: "cancer_colorretal", icd_prefix: "C18,C19,C20,C21" },
        Disease { label: "Câncer de próstata (C61)", slug: "cancer_prostata", icd_prefix: "C61" },
        Disease { label: "Doenças crônicas do fígado (K70-K77)", slug: "doencas_figado", icd_prefix: "K70,K71,K72,K73,K74,K75,K76,K77" },
        Disease { label: "Obesidade (E66)", slug: "obesidade", icd_prefix: "E66" },
    ]
}

fn ask_i32(prompt: &str, min: i32, max: i32, default: Option<i32>) -> i32 {
    let mut inp = Input::<i32>::new()
        .with_prompt(prompt)
        .validate_with(move |v: &i32| {
            if *v >= min && *v <= max {
                Ok(())
            } else {
                Err(format!("Valor inválido. Use entre {} e {}.", min, max))
            }
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
            if *v >= min && *v <= max {
                Ok(())
            } else {
                Err(format!("Valor inválido. Use entre {} e {}.", min, max))
            }
        })
        .interact_text()
        .unwrap()
}

fn build_selection(args: &Args) -> Selection {
    let ufs = uf_list();
    let uf_items: Vec<String> = ufs
        .iter()
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

    let ds = diseases();
    let disease_items: Vec<&str> = ds.iter().map(|d| d.label).collect();
    let disease_idx = FuzzySelect::new()
        .with_prompt("Selecione a condição crônica não transmissível (DCNT)")
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

    let anos_prev = ask_i32("Anos de previsão (ARIMA)", 1, 20, Some(3));
    let alpha = ask_f64("Alpha (ex.: 0.95)", 0.50, 0.999, 0.95);

    let date = today_ddmmyyyy_tz_minus3();
    let disease_slug = sanitize_component(disease.slug);
    let folder = format!("{}-{}-{}", date, disease_slug, analysis.slug);
    let out_folder = Path::new(&args.out_dir).join(folder);
    let out_csv = out_folder.join("dados_tabnet.csv");
    let out_clean = out_folder.join("dados_limpos.csv");
    let out_json = out_folder.join("saida_previsao.json");

    Selection {
        uf_sigla,
        uf_cod,
        uf_nome,
        analysis,
        disease,
        year_start,
        year_end,
        anos_prev,
        alpha,
        out_folder,
        out_csv,
        out_clean,
        out_json,
    }
}

fn run_r(args: &Args, sel: &Selection) {
    ensure_file_exists(&args.rfile, "Script R");
    fs::create_dir_all(&sel.out_folder).expect("Falha ao criar pasta de saída");

    let mut cmd = Command::new(&args.rscript);
    cmd.arg("--vanilla")
        .arg(&args.rfile)
        .arg("--system")
        .arg(sel.analysis.system)
        .arg("--uf")
        .arg(&sel.uf_sigla)
        .arg("--year-start")
        .arg(sel.year_start.to_string())
        .arg("--year-end")
        .arg(sel.year_end.to_string())
        .arg("--granularity")
        .arg("year")
        .arg("--icd-prefix")
        .arg(sel.disease.icd_prefix)
        .arg("--out")
        .arg(sel.out_csv.to_string_lossy().to_string())
        .arg("--out-clean")
        .arg(sel.out_clean.to_string_lossy().to_string());

    println!("\n[R] {}", cmd_to_string(&cmd));
    let status = cmd
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .expect("Falha ao executar Rscript");

    if !status.success() {
        eprintln!("[ERRO] Rscript falhou.");
        std::process::exit(2);
    }
}

fn run_python(args: &Args, sel: &Selection) {
    ensure_file_exists(&args.pyfile, "Script Python");

    let mut cmd = Command::new(&args.python);
    cmd.arg(&args.pyfile)
        .arg("--csv")
        .arg(sel.out_csv.to_string_lossy().to_string())
        .arg("--estado")
        .arg(&sel.uf_cod)
        .arg("--anos-prev")
        .arg(sel.anos_prev.to_string())
        .arg("--alpha")
        .arg(sel.alpha.to_string())
        .arg("--saida")
        .arg(sel.out_json.to_string_lossy().to_string())
        .arg("--pretty");

    println!("\n[PY] {}", cmd_to_string(&cmd));
    let status = cmd
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .expect("Falha ao executar Python");

    if !status.success() {
        eprintln!("[ERRO] Python falhou.");
        std::process::exit(3);
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

fn print_summary(sel: &Selection) {
    println!("\n================ RESUMO ================");
    println!("UF: {} ({}) - {}", sel.uf_sigla, sel.uf_cod, sel.uf_nome);
    println!("Tipo: {}", sel.analysis.label);
    println!("Condição (DCNT): {}", sel.disease.label);
    println!("Período: {}-{}", sel.year_start, sel.year_end);
    println!("ARIMA (Python): {} anos | alpha={}", sel.anos_prev, sel.alpha);
    println!("Pasta de saída: {}", sel.out_folder.to_string_lossy());
    println!("- CSV TABNET-like: {}", sel.out_csv.to_string_lossy());
    println!("- CSV limpo:       {}", sel.out_clean.to_string_lossy());
    println!("- JSON previsão:   {}", sel.out_json.to_string_lossy());
    println!("=======================================\n");
}

fn main_menu(args: Args) {
    ensure_file_exists(&args.rfile, "Script R");
    ensure_file_exists(&args.pyfile, "Script Python");

    println!("\nDATASUS → Rust → Python (ARIMA)");
    println!("- Nenhum caminho de arquivo é solicitado ao usuário.");
    println!("- Você escolhe UF, tipo de análise, DCNT e período.");
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
            let again = Confirm::new()
                .with_prompt("Voltar ao menu?")
                .default(true)
                .interact()
                .unwrap();
            if !again {
                break;
            }
            continue;
        }

        run_r(&args, &sel);
        run_python(&args, &sel);

        println!("\n[OK] Concluído! Arquivos gerados em: {}", sel.out_folder.to_string_lossy());

        let again = Confirm::new()
            .with_prompt("Rodar outra análise?")
            .default(true)
            .interact()
            .unwrap();
        if !again {
            break;
        }
    }
}

fn main() {
    let args = Args::parse();
    main_menu(args);
}
