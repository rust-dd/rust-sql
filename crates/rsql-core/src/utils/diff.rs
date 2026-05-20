use rayon::prelude::*;
use std::collections::HashSet;

const ROW_SEP: char = '\x1E';

fn parse_packed_rows(packed: &str) -> Vec<&str> {
    if packed.is_empty() {
        return Vec::new();
    }
    let parts: Vec<&str> = packed.split(ROW_SEP).collect();
    if parts.len() > 1 {
        parts[1..].to_vec()
    } else {
        Vec::new()
    }
}

fn pack_rows(header: &str, rows: &[&str]) -> String {
    if rows.is_empty() {
        return header.to_string();
    }
    let mut result =
        String::with_capacity(header.len() + rows.iter().map(|r| r.len() + 1).sum::<usize>());
    result.push_str(header);
    for row in rows {
        result.push(ROW_SEP);
        result.push_str(row);
    }
    result
}

pub fn compute_diff(pinned_packed: &str, current_packed: &str) -> (String, String, usize) {
    let pinned_rows = parse_packed_rows(pinned_packed);
    let current_rows = parse_packed_rows(current_packed);

    let pinned_set: HashSet<&str> = pinned_rows.iter().copied().collect();
    let current_set: HashSet<&str> = current_rows.iter().copied().collect();

    let (added, removed, unchanged_count) = if current_rows.len() > 5000 || pinned_rows.len() > 5000
    {
        let added: Vec<&str> = current_rows
            .par_iter()
            .filter(|r| !pinned_set.contains(*r))
            .copied()
            .collect();
        let removed: Vec<&str> = pinned_rows
            .par_iter()
            .filter(|r| !current_set.contains(*r))
            .copied()
            .collect();
        let unchanged: usize = current_rows
            .par_iter()
            .filter(|r| pinned_set.contains(*r))
            .count();
        (added, removed, unchanged)
    } else {
        let added: Vec<&str> = current_rows
            .iter()
            .filter(|r| !pinned_set.contains(*r))
            .copied()
            .collect();
        let removed: Vec<&str> = pinned_rows
            .iter()
            .filter(|r| !current_set.contains(*r))
            .copied()
            .collect();
        let unchanged: usize = current_rows
            .iter()
            .filter(|r| pinned_set.contains(*r))
            .count();
        (added, removed, unchanged)
    };

    let header = pinned_packed.split(ROW_SEP).next().unwrap_or("");
    (
        pack_rows(header, &added),
        pack_rows(header, &removed),
        unchanged_count,
    )
}
