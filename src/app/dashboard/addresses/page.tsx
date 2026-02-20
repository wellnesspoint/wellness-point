"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Plus, Pencil, Trash2, Star, X } from "lucide-react";
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
  isDefault: false,
};

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
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
      toast.success("Addresses updated");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    setForm(emptyAddress);
    setEditIdx(null);
    setShowForm(true);
  };

  const handleEdit = (idx: number) => {
    setForm({ ...addresses[idx] });
    setEditIdx(idx);
    setShowForm(true);
  };

  const handleDelete = (idx: number) => {
    const updated = addresses.filter((_, i) => i !== idx);
    saveAddresses(updated);
  };

  const handleSetDefault = (idx: number) => {
    const updated = addresses.map((a, i) => ({
      ...a,
      isDefault: i === idx,
    }));
    saveAddresses(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.phone || !form.street || !form.city || !form.state || !form.pincode) {
      toast.error("Please fill all fields");
      return;
    }

    let updated: Address[];
    if (editIdx !== null) {
      updated = addresses.map((a, i) => (i === editIdx ? form : a));
    } else {
      // If first address, make it default
      const newAddr = {
        ...form,
        isDefault: addresses.length === 0 ? true : form.isDefault,
      };
      updated = [...addresses, newAddr];
    }
    saveAddresses(updated);
    setShowForm(false);
    setForm(emptyAddress);
    setEditIdx(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">My Addresses</h1>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Addresses</h1>
        {!showForm && (
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
              {editIdx !== null ? "Edit Address" : "New Address"}
            </CardTitle>
            <button
              onClick={() => {
                setShowForm(false);
                setEditIdx(null);
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
                  onChange={(e) =>
                    setForm({ ...form, pincode: e.target.value })
                  }
                  placeholder="400001"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-wellness-600"
                />
                <Label htmlFor="isDefault" className="mb-0 cursor-pointer">
                  Set as default
                </Label>
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  variant="wellness"
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  {saving ? "Saving..." : editIdx !== null ? "Update Address" : "Save Address"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Address Cards */}
      {addresses.length === 0 && !showForm ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <MapPin className="mx-auto mb-3 h-14 w-14 text-muted" />
            <p className="text-muted-foreground">No addresses saved</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr, idx) => (
            <Card
              key={idx}
              className={`relative border shadow-sm ${
                addr.isDefault
                  ? "border-wellness-300 bg-wellness-50/30"
                  : "border-gray-100"
              }`}
            >
              <CardContent className="p-5">
                {addr.isDefault && (
                  <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-wellness-100 px-2 py-0.5 text-xs font-medium text-wellness-700">
                    <Star className="h-3 w-3" /> Default
                  </span>
                )}
                <p className="text-sm font-semibold text-foreground">
                  {addr.fullName}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{addr.phone}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {addr.street}, {addr.city}, {addr.state} – {addr.pincode}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleEdit(idx)}
                    className="flex items-center gap-1 text-xs text-wellness-600 hover:text-wellness-700"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => handleDelete(idx)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefault(idx)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Star className="h-3 w-3" /> Set Default
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
