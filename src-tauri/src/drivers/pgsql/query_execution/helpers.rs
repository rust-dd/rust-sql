use tokio_postgres::SimpleQueryMessage;

use super::super::{CELL_SEP, ROW_SEP};

/// Process simple_query messages, returning the last result set that had rows.
/// If no result set had rows but commands ran, returns synthetic "N rows affected".
/// If nothing at all, returns empty vecs.
pub(crate) fn process_simple_messages(
    messages: Vec<SimpleQueryMessage>,
) -> (Vec<String>, Vec<Vec<String>>) {
    let mut cur_columns: Vec<String> = Vec::new();
    let mut cur_rows: Vec<Vec<String>> = Vec::new();
    let mut last_columns: Vec<String> = Vec::new();
    let mut last_rows: Vec<Vec<String>> = Vec::new();
    let mut has_row_result = false;
    let mut total_affected: u64 = 0;

    for msg in messages {
        match msg {
            SimpleQueryMessage::Row(row) => {
                let col_count = row.columns().len();
                if cur_columns.is_empty() {
                    cur_columns = Vec::with_capacity(col_count);
                    for c in row.columns() {
                        cur_columns.push(c.name().to_owned());
                    }
                }
                let mut cells = Vec::with_capacity(col_count);
                for i in 0..col_count {
                    cells.push(row.get(i).unwrap_or("null").to_owned());
                }
                cur_rows.push(cells);
            }
            SimpleQueryMessage::CommandComplete(n) => {
                if !cur_rows.is_empty() {
                    last_columns = std::mem::take(&mut cur_columns);
                    last_rows = std::mem::take(&mut cur_rows);
                    has_row_result = true;
                } else {
                    cur_columns.clear();
                    cur_rows.clear();
                }
                total_affected += n;
            }
            _ => {}
        }
    }

    // Handle trailing rows (shouldn't happen but be safe)
    if !cur_rows.is_empty() {
        return (cur_columns, cur_rows);
    }

    if has_row_result {
        (last_columns, last_rows)
    } else if total_affected > 0 {
        (
            vec!["Result".into()],
            vec![vec![format!("{} rows affected", total_affected)]],
        )
    } else {
        (Vec::new(), Vec::new())
    }
}

/// Join string slices with a char separator — avoids .to_string() on the separator.
#[inline]
pub(crate) fn join_sep(items: &[String], sep: char) -> String {
    let total: usize = items.iter().map(|s| s.len()).sum::<usize>() + items.len();
    let mut out = String::with_capacity(total);
    for (i, item) in items.iter().enumerate() {
        if i > 0 {
            out.push(sep);
        }
        out.push_str(item);
    }
    out
}

/// Pack a slice of rows (each row = Vec<String>) into wire format.
/// Pre-allocates capacity and writes directly — zero intermediate allocations.
pub(crate) fn pack_rows_vec(rows: &[Vec<String>]) -> String {
    if rows.is_empty() {
        return String::new();
    }
    // Estimate capacity: avg ~20 chars per cell
    let est = rows.len() * rows.first().map_or(10, |r| r.len()) * 20;
    let mut out = String::with_capacity(est);

    for (ri, row) in rows.iter().enumerate() {
        if ri > 0 {
            out.push(ROW_SEP);
        }
        for (ci, cell) in row.iter().enumerate() {
            if ci > 0 {
                out.push(CELL_SEP);
            }
            // Inline separator sanitization — avoids .replace() allocations
            for ch in cell.chars() {
                if ch == CELL_SEP || ch == ROW_SEP {
                    out.push(' ');
                } else {
                    out.push(ch);
                }
            }
        }
    }
    out
}
