# export_datasus_database.R
# Exports DATASUS microdata using microdatasus and writes:
# 1) TABNET-like CSV (with metadata + header)
# 2) Tidy CSV for BI/panel consumption

resolve_writable_r_library <- function() {
  current_libs <- .libPaths()
  writable_existing <- current_libs[
    dir.exists(current_libs) &
      file.access(current_libs, mode = 2) == 0
  ]
  if (length(writable_existing) > 0) {
    return(writable_existing[[1]])
  }

  user_lib <- Sys.getenv("R_LIBS_USER")
  if (nchar(user_lib) == 0) {
    major_minor <- paste0(R.version$major, ".", strsplit(R.version$minor, "\\.")[[1]][1])
    user_lib <- file.path(Sys.getenv("LOCALAPPDATA"), "R", "win-library", major_minor)
  }

  if (!dir.exists(user_lib)) {
    dir.create(user_lib, recursive = TRUE, showWarnings = FALSE)
  }
  if (!dir.exists(user_lib) || file.access(user_lib, mode = 2) != 0) {
    stop("No writable R library path found. Configure R_LIBS_USER with a writable folder.")
  }
  return(user_lib)
}

ensure_r_packages <- function(packages, repos = "https://cloud.r-project.org") {
  target_lib <- resolve_writable_r_library()
  .libPaths(unique(c(target_lib, .libPaths())))

  missing <- packages[!vapply(packages, requireNamespace, logical(1), quietly = TRUE)]
  if (length(missing) > 0) {
    message("Installing missing R packages in: ", target_lib)
    message("Packages: ", paste(missing, collapse = ", "))

    cran_missing <- setdiff(missing, "microdatasus")
    if (length(cran_missing) > 0) {
      tryCatch(
        {
          install.packages(cran_missing, repos = repos, dependencies = TRUE, lib = target_lib)
        },
        error = function(e) {
          stop(
            "Failed to install required R packages from CRAN: ",
            paste(cran_missing, collapse = ", "),
            ". Details: ",
            conditionMessage(e)
          )
        }
      )
    }

    # microdatasus may be unavailable for some R versions on CRAN, fallback to GitHub.
    if ("microdatasus" %in% missing && !requireNamespace("microdatasus", quietly = TRUE)) {
      message("microdatasus not available in CRAN for this R version. Trying GitHub fallback...")
      if (.Platform$OS.type == "windows") {
        if (!requireNamespace("pkgbuild", quietly = TRUE)) {
          install.packages("pkgbuild", repos = repos, dependencies = TRUE, lib = target_lib)
        }
        has_build_tools <- tryCatch(
          pkgbuild::has_build_tools(debug = FALSE),
          error = function(e) FALSE
        )
        if (!has_build_tools) {
          stop(
            "microdatasus is not available as binary for this R version and requires source build.\n",
            "Install Rtools for R ", R.version$major, ".", strsplit(R.version$minor, "\\.")[[1]][1], " and try again.\n",
            "Rtools download: https://cran.r-project.org/bin/windows/Rtools/"
          )
        }
      }

      if (!requireNamespace("remotes", quietly = TRUE)) {
        install.packages("remotes", repos = repos, dependencies = TRUE, lib = target_lib)
      }
      tryCatch(
        {
          remotes::install_github(
            "rfsaldanha/microdatasus",
            dependencies = TRUE,
            upgrade = "never",
            lib = target_lib
          )
        },
        error = function(e) {
          stop(
            "Failed to install microdatasus from GitHub fallback. Details: ",
            conditionMessage(e)
          )
        }
      )
    }
  }

  still_missing <- packages[!vapply(packages, requireNamespace, logical(1), quietly = TRUE)]
  if (length(still_missing) > 0) {
    stop(
      "Required R packages are still missing after installation attempt: ",
      paste(still_missing, collapse = ", "),
      ". Verify internet access and write permission to your R library path."
    )
  }
}

required_packages <- c("microdatasus", "dplyr", "tidyr", "lubridate")
ensure_r_packages(required_packages)

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
  name = c("Acre","Alagoas","Amapa","Amazonas","Bahia","Ceara","Distrito Federal","Espirito Santo","Goias","Maranhao","Mato Grosso","Mato Grosso do Sul","Minas Gerais","Para","Paraiba","Parana","Pernambuco","Piaui","Rio de Janeiro","Rio Grande do Norte","Rio Grande do Sul","Rondonia","Roraima","Santa Catarina","Sao Paulo","Sergipe","Tocantins"),
  stringsAsFactors = FALSE
)

month_labels_pt <- c("Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez")
args <- parse_args(commandArgs(trailingOnly = TRUE))

information_system <- if (!is.null(args$system)) args$system else "SIM-DO"
uf_arg <- if (!is.null(args$uf)) toupper(args$uf) else "MA"
year_start <- as.integer(if (!is.null(args$year_start)) args$year_start else 2018)
year_end <- as.integer(if (!is.null(args$year_end)) args$year_end else 2022)
month_start <- if (!is.null(args$month_start)) as.integer(args$month_start) else 1L
month_end <- if (!is.null(args$month_end)) as.integer(args$month_end) else 12L
icd_prefix <- if (!is.null(args$icd_prefix)) toupper(args$icd_prefix) else ""
granularity <- if (!is.null(args$granularity)) tolower(args$granularity) else "year"
out <- if (!is.null(args$out)) args$out else "tabnet_annual.csv"
out_clean <- if (!is.null(args$out_clean)) args$out_clean else "dataset_tidy.csv"

if (!(uf_arg %in% ufs$uf)) stop("Invalid UF: ", uf_arg)
if (!(granularity %in% c("year", "month"))) stop("Invalid granularity, use year or month.")
if (year_end < year_start) stop("year_end cannot be lower than year_start.")
if (month_start < 1 || month_start > 12 || month_end < 1 || month_end > 12) stop("month values must be 1..12.")
if (month_end < month_start && granularity == "month") stop("month_end cannot be lower than month_start.")

uf_row <- ufs[ufs$uf == uf_arg, , drop = FALSE]
options(timeout = 600)

raw <- fetch_datasus(
  year_start = year_start, year_end = year_end,
  month_start = month_start, month_end = month_end,
  uf = uf_arg,
  information_system = information_system
)

is_sim <- grepl("^SIM", information_system)
is_sih <- information_system == "SIH-RD"
if (!(is_sim || is_sih)) {
  stop("Unsupported system: ", information_system, ". Use SIM-* or SIH-RD.")
}

if (is_sim) {
  data_ready <- process_sim(raw) %>%
    mutate(
      event_date = as.Date(DTOBITO),
      cid_value = toupper(CAUSABAS)
    ) %>%
    filter(!is.na(event_date))
  source_desc <- "SIM deaths"
} else {
  data_ready <- process_sih(raw)

  date_candidates <- c("DT_INTER", "DT_INTERNA", "DT_INTERN", "DT_ENTRADA", "DTINTER")
  cid_candidates <- c("DIAG_PRINC", "DIAGPRINC", "DIAG_PRINCIPAL", "CIDPRI")
  date_column <- intersect(date_candidates, colnames(data_ready))[1]
  cid_column <- intersect(cid_candidates, colnames(data_ready))[1]

  if (is.na(date_column) || is.na(cid_column)) {
    stop("Could not find expected date/cid columns in SIH output.")
  }

  data_ready <- data_ready %>%
    mutate(
      event_date_raw = as.character(.data[[date_column]]),
      event_date = suppressWarnings(as.Date(event_date_raw)),
      event_date = coalesce(event_date, suppressWarnings(ymd(event_date_raw))),
      cid_value = toupper(as.character(.data[[cid_column]]))
    ) %>%
    filter(!is.na(event_date))
  source_desc <- "SIH admissions"
}

if (nchar(icd_prefix) > 0) {
  prefixes <- trimws(unlist(strsplit(icd_prefix, ",", fixed = TRUE)))
  data_ready <- data_ready %>%
    filter(Reduce(`|`, lapply(prefixes, function(prefix) startsWith(cid_value, prefix))))
}

if (granularity == "year") {
  aggregated <- data_ready %>%
    mutate(period_value = year(event_date)) %>%
    count(period_value, name = "valor")

  all_periods <- data.frame(period_value = seq(year_start, year_end))
  aggregated <- all_periods %>%
    left_join(aggregated, by = "period_value") %>%
    mutate(valor = ifelse(is.na(valor), 0L, valor))

  wide <- aggregated %>%
    mutate(`Unidade da Federacao` = paste0(uf_row$code, " ", uf_row$name)) %>%
    select(`Unidade da Federacao`, period_value, valor) %>%
    pivot_wider(names_from = period_value, values_from = valor, values_fill = 0)
} else {
  aggregated <- data_ready %>%
    mutate(month_value = floor_date(event_date, unit = "month")) %>%
    count(month_value, name = "valor")

  start_date <- as.Date(sprintf("%04d-%02d-01", year_start, month_start))
  end_date <- as.Date(sprintf("%04d-%02d-01", year_end, month_end))
  all_months <- data.frame(month_value = seq(from = start_date, to = end_date, by = "1 month"))

  aggregated <- all_months %>%
    left_join(aggregated, by = "month_value") %>%
    mutate(valor = ifelse(is.na(valor), 0L, valor)) %>%
    mutate(
      year_value = year(month_value),
      month_id = month(month_value),
      period_label = paste0(year_value, "/", month_labels_pt[month_id])
    )

  wide <- aggregated %>%
    mutate(`Unidade da Federacao` = paste0(uf_row$code, " ", uf_row$name)) %>%
    select(`Unidade da Federacao`, period_label, valor) %>%
    pivot_wider(names_from = period_label, values_from = valor, values_fill = 0)
}

meta <- c(
  "TABNET-like CSV generated via microdatasus",
  paste0("Source: ", source_desc),
  paste0("System: ", information_system),
  paste0("UF: ", uf_arg, " (", uf_row$code, " ", uf_row$name, ")"),
  paste0("Period: ", year_start, "-", year_end),
  paste0("Granularity: ", granularity),
  paste0("CID filter: ", ifelse(nchar(icd_prefix) > 0, icd_prefix, "none")),
  "Encoding: ISO-8859-1; Separator: ';'; header in line 10",
  "Generated for OCCNT panel."
)

header_line <- paste(colnames(wide), collapse = ";")
data_line <- paste(as.character(wide[1, ]), collapse = ";")
tabnet_text <- c(meta, header_line, data_line)
tabnet_latin1 <- iconv(tabnet_text, from = "UTF-8", to = "latin1")
writeLines(tabnet_latin1, con = out, useBytes = TRUE)

tidy <- wide %>%
  pivot_longer(cols = -`Unidade da Federacao`, names_to = "periodo", values_to = "valor") %>%
  mutate(
    sistema = information_system,
    uf_sigla = uf_arg,
    uf_codigo = uf_row$code,
    uf_nome = uf_row$name,
    granularidade = ifelse(granularity == "year", "annual", "monthly"),
    filtro_cid = ifelse(nchar(icd_prefix) > 0, icd_prefix, "none")
  ) %>%
  select(sistema, uf_sigla, uf_codigo, uf_nome, granularidade, filtro_cid, periodo, valor)

write.csv2(tidy, file = out_clean, row.names = FALSE, fileEncoding = "UTF-8")
message("OK -> ", out)
message("OK -> ", out_clean)
