use crate::{store::db::DBStore, tables::tables};
use leptos::{html::*, *};

pub fn sidebar() -> impl IntoView {
    let db = use_context::<DBStore>().unwrap();

    div()
        .attr(
            "class",
            "flex border-r-1 border-neutral-200 flex-col gap-2 px-4 pt-4 overflow-auto",
        )
        .child(p().attr("class", "font-semibold").child("Schemas"))
        .child(Show(ShowProps {
            when: move || db.is_connecting.get(),
            children: ChildrenFn::to_children(move || {
                Fragment::new(vec![p().child("Loading...").into_view()])
            }),
            fallback: ViewFn::from(div),
        }))
        .child(move || {
            db.schemas
                .get()
                .into_iter()
                .map(|(schema, toggle)| {
                    let s = schema.clone();
                    div()
                        .attr("key", &schema)
                        .child(
                            button()
                                .attr(
                                    "class",
                                    if toggle {
                                        "font-semibold"
                                    } else {
                                        "hover:font-semibold"
                                    },
                                )
                                .on(ev::click, move |_| {
                                    let s_clone = s.clone();
                                    db.schemas.update(move |prev| {
                                        prev.insert(s_clone, !toggle);
                                    });
                                })
                                .child(&schema),
                        )
                        .child(Show(ShowProps {
                            when: move || toggle,
                            children: ChildrenFn::to_children(move || {
                                Fragment::new(vec![tables(schema.clone()).into_view()])
                            }),
                            fallback: ViewFn::from(div),
                        }))
                })
                .collect_view()
        })
}

