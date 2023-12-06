use leptos::{html::*, leptos_dom::Each, *};

use crate::store::query::QueryState;

pub fn query_table() -> impl IntoView {
    let data = use_context::<QueryState>().unwrap();
    let when = move || !data.is_loading.get();
    let fallback = ViewFn::from(|| p().attr("class", "pl-2").child("Loading..."));
    let children = ChildrenFn::to_children(move || {
        Fragment::new(vec![table()
            .attr(
                "class",
                "table-auto w-full divide-y divide-x divide-gray-200",
            )
            .child(
                thead().attr("class", "sticky top-0 bg-white").child(
                    tr().attr(
                        "class",
                        "bg-gray-100 hover:bg-gray-200 divide-x divide-gray-200",
                    )
                    .child(Each::new(
                        move || data.sql_result.get().unwrap().0.clone(),
                        move |n| n.clone(),
                        move |col| th().attr("class", "text-xs px-4").child(col),
                    )),
                ),
            )
            .child(tbody().child(Each::new(
                move || data.sql_result.get().unwrap().1.clone(),
                move |n| n.clone(),
                move |row| {
                    tr().attr("class", "hover:bg-gray-100 divide-x divide-gray-200")
                        .child(Each::new(
                            move || row.clone(),
                            move |n| n.clone(),
                            move |cell| {
                                td().attr("class", "px-4 text-xs cursor:pointer")
                                    .child(cell)
                            },
                        ))
                },
            )))
            .into_view()])
    });

    Show(ShowProps {
        children,
        when,
        fallback,
    })
}

