import { Truck, CheckCircle, XCircle, Clock } from "lucide-react";
import {
  ORDER_STATUSES,
  ORDER_STATUS_TRANSITIONS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_TRANSITIONS,
  allowedNext,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/order-status";

export interface OrderItem {
  product: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  user?: { _id: string; name: string; email: string };
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    email?: string;
    phone: string;
    street: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  paymentStatus: string;
  orderStatus: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  couponCode?: string;
  tracking?: { courier?: string; trackingNumber?: string; trackingUrl?: string };
  statusHistory?: { field: string; from?: string; to: string; by?: string; at: string }[];
  internalNotes?: { text: string; by?: string; at: string }[];
  refunds?: { amount: number; reason?: string; by?: string; at: string }[];
  refundedAmount?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const orderStatusOptions: string[] = ORDER_STATUSES;

// Only legal next states are selectable (the API enforces the same rules).
export const nextOrderStatuses = (current: string) =>
  allowedNext(ORDER_STATUS_TRANSITIONS, current as OrderStatus, ORDER_STATUSES);
export const nextPaymentStatuses = (current: string) =>
  allowedNext(PAYMENT_STATUS_TRANSITIONS, current as PaymentStatus, PAYMENT_STATUSES);

export const statusColor: Record<string, string> = {
  processing: "bg-blue-100 text-blue-700",
  confirmed: "bg-cyan-100 text-cyan-700",
  shipped: "bg-purple-100 text-purple-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
};

export const statusIcon: Record<string, any> = {
  processing: Clock,
  confirmed: CheckCircle,
  shipped: Truck,
  delivered: CheckCircle,
  cancelled: XCircle,
};
