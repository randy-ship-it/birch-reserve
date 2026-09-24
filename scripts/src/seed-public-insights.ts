import { seedPublicInsights } from "@workspace/db";

const result = await seedPublicInsights();
console.log(JSON.stringify(result));
