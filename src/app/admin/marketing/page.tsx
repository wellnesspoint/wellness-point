"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Image,
  Link,
  RefreshCw,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Banner {
  _id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  linkUrl?: string;
  position: "hero" | "promo" | "sidebar";
  isActive: boolean;
  sortOrder: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

const emptyBanner: {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  position: "hero" | "promo" | "sidebar";
  isActive: boolean;
  sortOrder: number;
  startDate: string;
  endDate: string;
} = {
  title: "",
  subtitle: "",
  imageUrl: "",
  linkUrl: "",
  position: "hero",
  isActive: true,
  sortOrder: 0,
  startDate: "",
  endDate: "",
};

export default function MarketingPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(emptyBanner);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const fetchBanners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/banners");
      const json = await res.json();
      setBanners(json.banners || []);
    } catch (err) {
      console.error("Failed to load banners:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleSubmit = async () => {
    if (!form.title || !form.imageUrl) {
      alert("Title and Image URL are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing
        ? `/api/admin/banners/${editing}`
        : "/api/admin/banners";
      const method = editing ? "PUT" : "POST";

      const payload: any = { ...form };
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        setEditing(null);
        setForm(emptyBanner);
        fetchBanners();
      } else {
        alert("Failed to save banner");
      }
    } catch (err) {
      alert("Error saving banner");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    try {
      await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
      fetchBanners();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const toggleActive = async (banner: Banner) => {
    try {
      await fetch(`/api/admin/banners/${banner._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      fetchBanners();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const editBanner = (banner: Banner) => {
    setForm({
      title: banner.title,
      subtitle: banner.subtitle || "",
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || "",
      position: banner.position,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
      startDate: banner.startDate
        ? new Date(banner.startDate).toISOString().split("T")[0]
        : "",
      endDate: banner.endDate
        ? new Date(banner.endDate).toISOString().split("T")[0]
        : "",
    });
    setEditing(banner._id);
    setShowForm(true);
  };

  const updateSortOrder = async (id: string, newOrder: number) => {
    try {
      await fetch(`/api/admin/banners/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newOrder }),
      });
      fetchBanners();
    } catch (err) {
      console.error("Sort order error:", err);
    }
  };

  const filteredBanners =
    filter === "all"
      ? banners
      : banners.filter((b) => b.position === filter);

  const positionLabels: Record<string, string> = {
    hero: "Hero Slider",
    promo: "Promotional",
    sidebar: "Sidebar",
  };

  const positionColors: Record<string, string> = {
    hero: "bg-blue-100 text-blue-700",
    promo: "bg-purple-100 text-purple-700",
    sidebar: "bg-orange-100 text-orange-700",
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-emerald-500" />
            Marketing & Banners
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage promotional banners and homepage sliders
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(emptyBanner);
            setEditing(null);
            setShowForm(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Banner
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4 text-center">
            <p className="text-2xl font-bold text-foreground">{banners.length}</p>
            <p className="text-xs text-muted-foreground">Total Banners</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {banners.filter((b) => b.isActive).length}
            </p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {banners.filter((b) => b.position === "hero").length}
            </p>
            <p className="text-xs text-muted-foreground">Hero Sliders</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-4 px-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {banners.filter((b) => b.position === "promo").length}
            </p>
            <p className="text-xs text-muted-foreground">Promotions</p>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="border-0 shadow-sm ring-2 ring-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground">
              {editing ? "Edit Banner" : "New Banner"}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Title *</Label>
                <Input
                  value={form.title}
                  onChange={(e) =>
                    setForm({ ...form, title: e.target.value })
                  }
                  placeholder="Banner title"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Subtitle</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) =>
                    setForm({ ...form, subtitle: e.target.value })
                  }
                  placeholder="Optional subtitle text"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Image URL *</Label>
                <div className="relative">
                  <Image className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.imageUrl}
                    onChange={(e) =>
                      setForm({ ...form, imageUrl: e.target.value })
                    }
                    placeholder="https://..."
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Link URL</Label>
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={form.linkUrl}
                    onChange={(e) =>
                      setForm({ ...form, linkUrl: e.target.value })
                    }
                    placeholder="/products or https://..."
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Position</Label>
                <Select
                  value={form.position}
                  onValueChange={(v: any) =>
                    setForm({ ...form, position: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hero">Hero Slider</SelectItem>
                    <SelectItem value="promo">Promotional</SelectItem>
                    <SelectItem value="sidebar">Sidebar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sortOrder: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="flex items-end gap-3 pb-1">
                <input
                  type="checkbox"
                  id="bannerActive"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                />
                <Label
                  htmlFor="bannerActive"
                  className="text-foreground cursor-pointer"
                >
                  Active
                </Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">
                  Start Date (optional)
                </Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm({ ...form, startDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  End Date (optional)
                </Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm({ ...form, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Image Preview */}
            {form.imageUrl && (
              <div className="rounded-lg overflow-hidden border border-border max-h-48">
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {saving ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {editing ? "Update Banner" : "Create Banner"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "hero", "promo", "sidebar"].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "bg-emerald-600 text-white"
                : ""
            }
          >
            {f === "all"
              ? `All (${banners.length})`
              : `${positionLabels[f]} (${banners.filter((b) => b.position === f).length})`}
          </Button>
        ))}
      </div>

      {/* Banner List */}
      {filteredBanners.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No banners found</p>
          <p className="text-sm mt-1">Create your first banner to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBanners.map((banner) => (
            <Card
              key={banner._id}
              className={`border-0 shadow-sm overflow-hidden ${
                !banner.isActive ? "opacity-60" : ""
              }`}
            >
              {/* Image */}
              <div className="relative h-40 bg-muted">
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).className =
                      "w-full h-full bg-muted";
                  }}
                />
                <div className="absolute top-2 left-2 flex gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${positionColors[banner.position]}`}
                  >
                    {positionLabels[banner.position]}
                  </span>
                  {!banner.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </div>
                <span className="absolute top-2 right-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                  #{banner.sortOrder}
                </span>
              </div>

              <CardContent className="pt-3 pb-3 px-4">
                <h3 className="text-foreground font-medium truncate">
                  {banner.title}
                </h3>
                {banner.subtitle && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {banner.subtitle}
                  </p>
                )}
                {banner.linkUrl && (
                  <p className="text-xs text-emerald-600 truncate mt-1 flex items-center gap-1">
                    <Link className="h-3 w-3" />
                    {banner.linkUrl}
                  </p>
                )}
                {(banner.startDate || banner.endDate) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {banner.startDate
                      ? new Date(banner.startDate).toLocaleDateString()
                      : "∞"}{" "}
                    →{" "}
                    {banner.endDate
                      ? new Date(banner.endDate).toLocaleDateString()
                      : "∞"}
                  </p>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {new Date(banner.createdAt).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateSortOrder(
                          banner._id,
                          banner.sortOrder - 1
                        )
                      }
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateSortOrder(
                          banner._id,
                          banner.sortOrder + 1
                        )
                      }
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(banner)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    >
                      {banner.isActive ? (
                        <Eye className="h-3 w-3" />
                      ) : (
                        <EyeOff className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editBanner(banner)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-500"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(banner._id)}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
