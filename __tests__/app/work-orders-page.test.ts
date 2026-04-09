/**
 * Lightweight regression check that the work-orders page file exists
 * and exports a default function (helps catch accidental deletions
 * that could yield a 404 in production).
 */
import fs from "fs";
import path from "path";

describe("owner/work-orders page presence", () => {
  const filePath = path.join(process.cwd(), "app/owner/work-orders/page.tsx");

  it("contains a default export", () => {
    const src = fs.readFileSync(filePath, "utf8");
    expect(src).toContain("export default");
    expect(src).toContain("WorkOrdersPage");
  });
});
