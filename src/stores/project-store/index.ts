import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createCoreSlice, type CoreSlice } from "./core";
import { createConnectionSlice, type ConnectionSlice } from "./connection";
import { createSchemaSlice, type SchemaSlice } from "./schema";
import { createIndexesSlice, type IndexesSlice } from "./indexes";
import { createViewsSlice, type ViewsSlice } from "./views";

export type ProjectState = CoreSlice &
  ConnectionSlice &
  SchemaSlice &
  IndexesSlice &
  ViewsSlice;

export const useProjectStore = create<ProjectState>()(
  immer((...a) => ({
    ...createCoreSlice(...a),
    ...createConnectionSlice(...a),
    ...createSchemaSlice(...a),
    ...createIndexesSlice(...a),
    ...createViewsSlice(...a),
  })),
);
