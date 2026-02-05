# datasus_export_tabnet_csv.R
# Exporta uma tabela "TABNET-like" (metadados + header) compatível com ccnt2.py
# E opcionalmente exporta um CSV "limpo" (tidy) para abrir no Excel.
#
# Suporte atual:
#  - SIM-*  : óbitos (process_sim)  -> data = DTOBITO, CID = CAUSABAS
#  - SIH-RD : internações (process_sih) -> data = DT_INTER (ou equivalente), CID = DIAG_PRINC (ou equivalente)

suppressPackageStartupMessages({
  library(microdatasus)
  library(dplyr)
  library(tidyr)
  library(lubridate)
})

parse_args <- function(args) {
  out <- list()
  i <- 1
  while (i <= length(args)) {
    key <- args[i]
    if (startsWith(key, "--")) {
      name <- gsub("-", "_", substring(key, 3))
      if (i == length(args) || startsWith(args[i + 1], "--")) {
        out[[name]] <- TRUE
        i <- i + 1
      } else {
        out[[name]] <- args[i + 1]
        i <- i + 2
      }
    } else {
      i <- i + 1
    }
  }
  out
}

ufs <- data.frame(
  uf = c("AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"),
  code = c("12","27","16","13","29","23","53","32","52","21","51","50","31","15","25","41","26","22","33","24","43","11","14","42","35","28","17"),
  name = c("Acre","Alagoas","Amapá","Amazonas","Bahia","Ceará","Distrito Federal","Espírito Santo","Goiás","Maranhão","Mato Grosso","Mato Grosso do Sul","Minas Gerais","Pará","Paraíba","Paraná","Pernambuco","Piauí","Rio de Janeiro","Rio Grande do Norte","Rio Grande do Sul","Rondônia","Roraima","Santa Catarina","São Paulo","Sergipe","Tocantins"),
  stringsAsFactors = FALSE
)

mes_abv_pt <- c("Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez")

args <- parse_args(commandArgs(trailingOnly = TRUE))

information_system <- if (!is.null(args$system)) args$system else "SIM-DO"
uf_arg <- if (!is.null(args$uf)) toupper(args$uf) else "MA"

year_start <- as.integer(if (!is.null(args$year_start)) args$year_start else 2016)
year_end <- as.integer(if (!is.null(args$year_end)) args$year_end else 2019)

month_start <- if (!is.null(args$month_start)) as.integer(args$month_start) else NA_integer_
month_end <- if (!is.null(args$month_end)) as.integer(args$month_end) else NA_integer_

icd_prefix <- if (!is.null(args$icd_prefix)) toupper(args$icd_prefix) else ""
granularity <- if (!is.null(args$granularity)) tolower(args$granularity) else "year"

out <- if (!is.null(args$out)) args$out else "dados_tabnet.csv"
out_clean <- if (!is.null(args$out_clean)) args$out_clean else ""

options(timeout = 600)

# --- validações ---
if (!(uf_arg %in% ufs$uf)) stop("UF inválida: ", uf_arg)
uf_row <- ufs[ufs$uf == uf_arg, , drop = FALSE]
if (nrow(uf_row) != 1) stop("UF inválida: ", uf_arg)

if (!(granularity %in% c("year", "month"))) {
  stop("granularity inválida. Use 'year' ou 'month'.")
}

# define intervalo efetivo (principalmente para modo mensal)
if (is.na(month_start)) month_start <- 1L
if (is.na(month_end)) month_end <- 12L

message("========================================")
message("microdatasus export (TABNET-like)")
message("Sistema: ", information_system)
message("UF: ", uf_arg, " (", uf_row$code, " ", uf_row$name, ")")
message("Periodo: ", year_start, "-", year_end)
message("Granularidade: ", ifelse(granularity=="year","anual","mensal"))
message("Filtro CID-10: ", ifelse(nchar(icd_prefix)>0, icd_prefix, "nenhum"))
message("Saida TABNET-like: ", out)
if (nchar(out_clean) > 0) message("Saida limpa: ", out_clean)
message("========================================")

# --- baixa via microdatasus ---
raw <- fetch_datasus(
  year_start = year_start, year_end = year_end,
  month_start = month_start, month_end = month_end,
  uf = uf_arg,
  information_system = information_system
)

is_sim <- grepl("^SIM", information_system)
is_sih <- information_system == "SIH-RD"

if (!(is_sim || is_sih)) {
  stop("Sistema não suportado neste exportador: ", information_system,
       "\nUse SIM-* (ex.: SIM-DO) ou SIH-RD.")
}

if (is_sim) {
  dat <- process_sim(raw) %>%
    mutate(
      DTOBITO = as.Date(DTOBITO),
      CAUSABAS = toupper(CAUSABAS)
    ) %>%
    filter(!is.na(DTOBITO))

  date_col <- "DTOBITO"
  icd_col <- "CAUSABAS"
  what_is <- paste0("contagem de óbitos (SIM) por ", ifelse(granularity=="year","ANO","MÊS"), " do óbito (DTOBITO)")
} else {
  dat <- process_sih(raw)

  # tenta localizar colunas com data e CID de forma robusta
  date_candidates <- c("DT_INTER", "DT_INTERNA", "DT_INTERN", "DT_ENTRADA", "DTINTER")
  icd_candidates  <- c("DIAG_PRINC", "DIAGPRINC", "DIAG_PRINCIPAL", "CIDPRI")

  date_col_raw <- intersect(date_candidates, colnames(dat))[1]
  icd_col_raw  <- intersect(icd_candidates,  colnames(dat))[1]

  if (is.na(date_col_raw) || is.na(icd_col_raw)) {
    stop("Não encontrei colunas esperadas no SIH após process_sih().\n",
         "Colunas presentes: ", paste(colnames(dat), collapse=", "))
  }

  dat <- dat %>%
    mutate(
      .data_date_raw = as.character(.data[[date_col_raw]]),
      .data_date = suppressWarnings(as.Date(.data_date_raw)),
      .data_date = coalesce(.data_date, suppressWarnings(ymd(.data_date_raw))),
      .data_icd  = toupper(as.character(.data[[icd_col_raw]]))
    ) %>%
    filter(!is.na(.data_date))

  date_col <- ".data_date"   # padroniza para o restante do script
  icd_col  <- ".data_icd"
  what_is <- paste0("contagem de internações (SIH) por ", ifelse(granularity=="year","ANO","MÊS"), " da internação (", date_col_raw, ")")
}

# filtro opcional por prefixos CID-10
if (nchar(icd_prefix) > 0) {
  prefixes <- unlist(strsplit(icd_prefix, ",", fixed = TRUE))
  prefixes <- trimws(prefixes)
  dat <- dat %>%
    filter(Reduce(`|`, lapply(prefixes, function(p) startsWith(.data[[icd_col]], p))))
}

# --- agrega ---
if (granularity == "year") {
  dat2 <- dat %>%
    mutate(periodo = year(.data[[date_col]])) %>%
    count(periodo, name = "valor")

  all_periods <- data.frame(periodo = seq(year_start, year_end))

  agg2 <- all_periods %>%
    left_join(dat2, by = "periodo") %>%
    mutate(valor = ifelse(is.na(valor), 0L, valor))

  wide <- agg2 %>%
    mutate(`Unidade da Federação` = paste0(uf_row$code, " ", uf_row$name)) %>%
    select(`Unidade da Federação`, periodo, valor) %>%
    pivot_wider(names_from = periodo, values_from = valor, values_fill = 0)

  period_desc <- paste0(year_start, "-", year_end)
} else {
  dat2 <- dat %>%
    mutate(m0 = floor_date(.data[[date_col]], unit = "month")) %>%
    count(m0, name = "valor")

  start_date <- as.Date(sprintf("%04d-%02d-01", year_start, month_start))
  end_date <- as.Date(sprintf("%04d-%02d-01", year_end, month_end))
  all_m <- data.frame(m0 = seq(from = start_date, to = end_date, by = "1 month"))

  agg2 <- all_m %>%
    left_join(dat2, by = "m0") %>%
    mutate(valor = ifelse(is.na(valor), 0L, valor)) %>%
    mutate(
      ano = year(m0),
      mes = month(m0),
      periodo_label = paste0(ano, "/", mes_abv_pt[mes])
    )

  wide <- agg2 %>%
    mutate(`Unidade da Federação` = paste0(uf_row$code, " ", uf_row$name)) %>%
    select(`Unidade da Federação`, periodo_label, valor) %>%
    pivot_wider(names_from = periodo_label, values_from = valor, values_fill = 0)

  period_desc <- paste0(format(start_date, "%Y-%m"), " até ", format(end_date, "%Y-%m"))
}

# --- escreve TABNET-like (9 linhas de metadados + header) ---
meta <- c(
  "TABNET-like CSV (gerado via microdatasus) - pronto para ccnt2.py",
  paste0("O que é: ", what_is),
  paste0("Fonte: DATASUS/", ifelse(is_sim,"SIM","SIH"), " (arquivos .dbc) - consulta por UF informada"),
  paste0("Sistema: ", information_system),
  paste0("UF: ", uf_arg, " (", uf_row$code, " ", uf_row$name, ")"),
  paste0("Período: ", period_desc),
  paste0("Filtro CID-10: ", ifelse(nchar(icd_prefix)>0, icd_prefix, "nenhum")),
  "Formato: separador=';' | encoding=ISO-8859-1 | (metadados 1-9, cabeçalho na linha 10)",
  paste0("Dica: python ccnt2.py --csv ", out, " --estado '", uf_row$code, "' --anos-prev 3 --alpha 0.95 --pretty")
)

header <- paste(colnames(wide), collapse = ";")
row1 <- paste(as.character(wide[1, ]), collapse = ";")
txt <- c(meta, header, row1)
txt_latin1 <- iconv(txt, from = "UTF-8", to = "latin1")
writeLines(txt_latin1, con = out, useBytes = TRUE)

message("OK -> ", out)

# --- escreve CSV limpo (opcional) ---
if (nchar(out_clean) > 0) {
  # transforma o wide em tidy para Excel/BI
  tidy <- wide %>%
    pivot_longer(cols = -`Unidade da Federação`, names_to = "periodo", values_to = "valor") %>%
    mutate(
      uf_sigla = uf_arg,
      uf_codigo = uf_row$code,
      uf_nome = uf_row$name,
      sistema = information_system,
      filtro_cid = ifelse(nchar(icd_prefix)>0, icd_prefix, "nenhum"),
      granularidade = ifelse(granularity=="year","anual","mensal")
    ) %>%
    select(sistema, uf_sigla, uf_codigo, uf_nome, granularidade, filtro_cid, periodo, valor)

  write.csv2(tidy, file = out_clean, row.names = FALSE, fileEncoding = "UTF-8")
  message("OK -> ", out_clean)
}
