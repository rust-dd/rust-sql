use tokio_postgres::SimpleQueryMessage;

use super::super::wire::Cell;

/// Process simple_query messages, returning the last result set that had rows.
/// If no result set had rows but commands ran, returns synthetic "N rows affected".
/// If nothing at all, returns empty vecs.
pub(crate) fn process_simple_messages(
    messages: Vec<SimpleQueryMessage>,
) -> (Vec<String>, Vec<Vec<Cell>>) {
    let mut cur_columns: Vec<String> = Vec::new();
    let mut cur_rows: Vec<Vec<Cell>> = Vec::new();
    let mut last_columns: Vec<String> = Vec::new();
    let mut last_rows: Vec<Vec<Cell>> = Vec::new();
    let mut has_row_result = false;
    let mut total_affected: u64 = 0;

    for msg in messages {
        match msg {
            SimpleQueryMessage::Row(row) => {
                if cur_columns.is_empty() {
                    cur_columns = column_names(&row);
                }
                cur_rows.push(row_cells(&row));
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
            vec![vec![Some(format!("{} rows affected", total_affected))]],
        )
    } else {
        (Vec::new(), Vec::new())
    }
}

/// Column names of a simple-query row, in result order.
pub(crate) fn column_names(row: &tokio_postgres::SimpleQueryRow) -> Vec<String> {
    row.columns().iter().map(|c| c.name().to_owned()).collect()
}

/// Cell values of a simple-query row. `None` is SQL NULL.
pub(crate) fn row_cells(row: &tokio_postgres::SimpleQueryRow) -> Vec<Cell> {
    let col_count = row.columns().len();
    let mut cells = Vec::with_capacity(col_count);
    for i in 0..col_count {
        cells.push(row.get(i).map(str::to_owned));
    }
    cells
}
