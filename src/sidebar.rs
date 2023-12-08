use crate::{
    invoke::InvokeProjectsArgs, store::db::DBStore, tables::tables, wasm_functions::invoke,
};
use leptos::{html::*, *};

pub fn sidebar() -> impl IntoView {
    let db = use_context::<DBStore>().unwrap();
    let get_project_details = create_action(move |(db, project): &(DBStore, String)| {
        let mut db_clone = *db;
        let project = project.clone();
        async move { db_clone.get_project_details(project).await }
    });
    let projects = create_resource(
        || {},
        move |_| async move {
            let projects = invoke(
                "get_projects",
                serde_wasm_bindgen::to_value(&InvokeProjectsArgs).unwrap(),
            )
            .await;
            let projects = serde_wasm_bindgen::from_value::<Vec<String>>(projects).unwrap();
            projects
        },
    );
    provide_context(projects);

    div()
        .attr(
            "class",
            "flex border-r-1 border-neutral-200 flex-col gap-2 px-4 pt-4 overflow-auto",
        )
        .child(Suspense(SuspenseProps {
            children: ChildrenFn::to_children(move || {
                Fragment::new(vec![div()
                    .child(p().attr("class", "font-semibold").child("Projects"))
                    .child(move || {
                        projects
                            .get()
                            .unwrap_or(Vec::new())
                            .into_iter()
                            .enumerate()
                            .map(|(idx, project)| {
                                button()
                                    .attr("key", idx)
                                    .attr("class", "hover:font-semibold")
                                    .child(&project)
                                    .on(ev::click, move |_| {
                                        get_project_details.dispatch((db.clone(), project.clone()))
                                    })
                            })
                            .collect_view()
                    })
                    .into_view()])
            }),
            fallback: ViewFn::from(|| p().child("Loading...")),
        }))
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

