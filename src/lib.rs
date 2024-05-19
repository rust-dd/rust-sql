extern crate proc_macro;

use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, ItemFn};

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

