# koishi-plugin-database-console

[![npm](https://img.shields.io/npm/v/koishi-plugin-database-console?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-database-console)

Database Service for Console Plugins

## Example

### Backend

```typescript
import { Context, Schema } from "koishi";
import { resolve } from "path";
import {} from "@koishijs/plugin-console";

export const name = "baz";
export const inject = ["console", "database-console"];
export interface Config {}
export const Config: Schema<Config> = Schema.object({});

export function apply(ctx: Context) {
  ctx.console.addEntry({
    dev: resolve(__dirname, "../client/index.ts"),
    prod: resolve(__dirname, "../dist"),
  });
}
```

### Frontend

```typescript
import { Context } from "@koishijs/client";
import type {} from "koishi-plugin-database-console";

export default (ctx: Context) => {
  ctx.inject(["database"], async (ctx) => {
    console.log(await ctx.database.get("user", { id: 0 }));
  });
};
```

### In Component

```vue
<script lang="ts" setup>
import { Context, useContext } from "@koishijs/client";
const ctx: Context = useContext();
ctx.get("database")?.get("user", { id: 0 }).then(console.log);
</script>
```
