import { randomUUID } from "node:crypto";
import { getDb } from "./index";
import { getPlan } from "./plans";
import { ORDER_TRANSITIONS, type CreateOrderRequest, type Order, type OrderStatus } from "../schemas/plan";

/** Every status key, so summaries always report a count (0 when there are none). */
const STATUSES = Object.keys(ORDER_TRANSITIONS) as OrderStatus[];

export class OrderError extends Error {
  constructor(
    readonly code: "PLAN_NOT_FOUND" | "UNKNOWN_PRODUCT" | "ORDER_NOT_FOUND" | "INVALID_TRANSITION",
    message = code,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

type OrderRow = {
  id: string;
  customer_name: string;
  customer_contact: string | null;
  product_name: string;
  quantity: number;
  unit_price_sen: number;
  subtotal_sen: number;
  fulfilment_option: string;
  requested_datetime: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerContact: row.customer_contact,
    productName: row.product_name,
    quantity: row.quantity,
    unitPriceSen: row.unit_price_sen,
    subtotalSen: row.subtotal_sen,
    fulfilmentOption: row.fulfilment_option as Order["fulfilmentOption"],
    requestedDatetime: row.requested_datetime,
    status: row.status as OrderStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createOrder(planId: string, req: CreateOrderRequest): Order {
  const plan = getPlan(planId);
  if (!plan) throw new OrderError("PLAN_NOT_FOUND");

  const wanted = req.productName.trim().toLowerCase();
  const product = plan.growth?.products.find((p) => p.name.trim().toLowerCase() === wanted);
  if (!product) throw new OrderError("UNKNOWN_PRODUCT");

  const now = new Date().toISOString();
  const order: Order = {
    id: randomUUID(),
    customerName: req.customerName,
    customerContact: req.customerContact ?? null,
    // Price comes from the plan's catalogue and the subtotal is computed here: never from the request.
    productName: product.name,
    quantity: req.quantity,
    unitPriceSen: product.priceSen,
    subtotalSen: req.quantity * product.priceSen,
    fulfilmentOption: req.fulfilmentOption,
    requestedDatetime: req.requestedDatetime ?? null,
    status: "PENDING",
    notes: req.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  getDb()
    .prepare(
      `INSERT INTO orders
         (id, customer_name, customer_contact, product_name, quantity, unit_price_sen, subtotal_sen,
          fulfilment_option, requested_datetime, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      order.id,
      order.customerName,
      order.customerContact,
      order.productName,
      order.quantity,
      order.unitPriceSen,
      order.subtotalSen,
      order.fulfilmentOption,
      order.requestedDatetime,
      order.status,
      order.notes,
      order.createdAt,
      order.updatedAt,
    );
  return order;
}

export function getOrder(id: string): Order | null {
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  return row ? toOrder(row) : null;
}

export function listOrders(filter?: { status?: OrderStatus }): Order[] {
  const db = getDb();
  // rowid breaks ties between orders created in the same millisecond.
  const rows = filter?.status
    ? (db.prepare("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC, rowid DESC").all(filter.status) as OrderRow[])
    : (db.prepare("SELECT * FROM orders ORDER BY created_at DESC, rowid DESC").all() as OrderRow[]);
  return rows.map(toOrder);
}

export function updateOrderStatus(id: string, next: OrderStatus): Order {
  const db = getDb();
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!row) throw new OrderError("ORDER_NOT_FOUND");

  const current = row.status as OrderStatus;
  if (!ORDER_TRANSITIONS[current].includes(next)) throw new OrderError("INVALID_TRANSITION");

  const now = new Date().toISOString();
  // Compare-and-swap on the status we validated, so a concurrent writer cannot slip in an illegal move.
  const { changes } = db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?").run(next, now, id, current);
  if (changes === 0) return updateOrderStatus(id, next);
  return { ...toOrder(row), status: next, updatedAt: now };
}

export function orderSummary(): { totalOrders: number; byStatus: Record<OrderStatus, number>; revenueSen: number } {
  const db = getDb();
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  let totalOrders = 0;
  const counts = db.prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").all() as {
    status: OrderStatus;
    n: number;
  }[];
  for (const { status, n } of counts) {
    byStatus[status] = n;
    totalOrders += n;
  }
  const { revenueSen } = db
    .prepare("SELECT COALESCE(SUM(subtotal_sen), 0) AS revenueSen FROM orders WHERE status <> ?")
    .get("CANCELLED") as { revenueSen: number };
  return { totalOrders, byStatus, revenueSen };
}

const CSV_HEADER = "id,customerName,productName,quantity,unitPriceSen,subtotalSen,fulfilmentOption,status,createdAt";

function csvField(value: string): string {
  // A leading = + - @ (or tab / CR) is executed as a formula when the CSV is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function ordersToCsv(orders: Order[]): string {
  const lines = [CSV_HEADER];
  for (const o of orders) {
    lines.push(
      [
        o.id,
        o.customerName,
        o.productName,
        o.quantity,
        o.unitPriceSen,
        o.subtotalSen,
        o.fulfilmentOption,
        o.status,
        o.createdAt,
      ]
        .map((v) => csvField(String(v)))
        .join(","),
    );
  }
  return lines.join("\r\n");
}
