"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Plus, Pencil, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

interface Address {
  _id?: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

const emptyAddress: Address = {
  fullName: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  pincode: "",
  isDefault: true, // Always default since only 1 address
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Address>(emptyAddress);
  const [saving, setSaving] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      const data = await res.json();
      setAddresses(data.user?.addresses || []);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const saveAddresses = async (updated: Address[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: updated }),
      });
      if (!res.ok) throw new Error();
      setAddresses(updated);
      toast.success("Address updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    setForm(emptyAddress);
    setEditing(false);
    setShowForm(true);
  };

  const handleEdit = () => {
    if (addresses[0]) {
      setForm({ ...addresses[0] });
      setEditing(true);
      setShowForm(true);
    }
  };

  const handleDelete = () => {
    saveAddresses([]);
    setShowForm(false);
    setEditing(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.street || !form.city || !form.state || !form.pincode) {
      toast.error("Please fill all fields");
      return;
    }
    if (form.phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error("Pincode must be exactly 6 digits");
      return;
    }

    // Always save as default (only 1 address)
    const addr: Address = { ...form, isDefault: true };
    saveAddresses([addr]);
    setShowForm(false);
    setEditing(false);
    setForm(emptyAddress);
  };

  const hasAddress = addresses.length > 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">My Address</h1>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Address</h1>
        {!showForm && !hasAddress && (
          <Button size="sm" variant="wellness" onClick={handleAdd}>
            <Plus className="mr-1 h-4 w-4" /> Add Address
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">
              {editing ? "Edit Address" : "New Address"}
            </CardTitle>
            <button
              onClick={() => {
                setShowForm(false);
                setEditing(false);
              }}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="8722485312"
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Street Address</Label>
                <Input
                  value={form.street}
                  onChange={(e) =>
                    setForm({ ...form, street: e.target.value })
                  }
                  placeholder="123, MG Road"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={form.city}
                  onChange={(e) =>
                    setForm({ ...form, city: e.target.value })
                  }
                  placeholder="Bengaluru"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  value={form.state}
                  onChange={(e) =>
                    setForm({ ...form, state: e.target.value })
                  }
                  placeholder="Karnataka"
                />
              </div>
              <div>
                <Label>Pincode</Label>
                <Input
                  value={form.pincode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setForm({ ...form, pincode: val });
                  }}
                  placeholder="560001"
                  maxLength={6}
                  inputMode="numeric"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  variant="wellness"
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  {saving ? "Saving..." : editing ? "Update Address" : "Save Address"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Address Card (max 1) */}
      {!hasAddress && !showForm ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <MapPin className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No address saved yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your address here or it will be saved automatically when you place your first order.
            </p>
          </CardContent>
        </Card>
      ) : hasAddress && !showForm ? (
        <Card className="border shadow-sm border-wellness-300 bg-wellness-50/30">
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-foreground">
              {addresses[0].fullName}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{addresses[0].phone}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {addresses[0].street}, {addresses[0].city}, {addresses[0].state} – {addresses[0].pincode}
            </p>
            <div className="mt-3 flex gap-3">
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 text-xs text-wellness-600 hover:text-wellness-700"
              >
                <Pencil className="h-3 w-3" /> Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
