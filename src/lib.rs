extern crate proc_macro;

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, Data, DeriveInput, Fields, ItemFn};

#[proc_macro_attribute]
pub fn set_running_query(_attr: TokenStream, item: TokenStream) -> TokenStream {
  let input = parse_macro_input!(item as ItemFn);

  let vis = &input.vis;
  let sig = &input.sig;
  let block = &input.block;

  let gen = quote! {
      #vis #sig {
          let run_query_atom = expect_context::<RunQueryContext>();
          run_query_atom.set(RunQueryAtom { is_running: true });

          let result = async {
              #block
          }.await;

          run_query_atom.set(RunQueryAtom { is_running: false });

          result
      }
  };

  TokenStream::from(gen)
}

#[proc_macro_derive(StructIntoIterator)]
pub fn into_iterator_derive(input: TokenStream) -> TokenStream {
  let input = parse_macro_input!(input as DeriveInput);

  let name = &input.ident;

  let fields = match input.data {
    Data::Struct(data_struct) => match data_struct.fields {
      Fields::Named(fields_named) => fields_named.named,
      _ => panic!("IntoIterator can only be derived for structs with named fields."),
    },
    _ => panic!("IntoIterator can only be derived for structs."),
  };

  let field_names = fields.iter().filter_map(|f| {
    let field_type = &f.ty;
    if let syn::Type::Path(type_path) = field_type {
      if type_path
        .path
        .segments
        .iter()
        .any(|segment| segment.ident == "String")
      {
        return f.ident.as_ref();
      }
    }
    None
  });

  let gen = quote! {
      impl IntoIterator for #name {
          type Item = String;
          type IntoIter = std::vec::IntoIter<String>;

          fn into_iter(self) -> Self::IntoIter {
              let mut vec = Vec::new();
              #(
                  vec.push(self.#field_names.to_owned());
              )*
              vec.into_iter()
          }
      }
  };

  gen.into()
}

