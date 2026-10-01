"use client";

import toast from "react-hot-toast";
import { useEffect, useState, useCallback } from "react";
import {
  Truck,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  Package,
  MapPin,
  Clock,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ShippingZone {
  name: string;
  states: string[];
  rate: number;
  estimatedDays: number;
}

interface ShippingData {
  flatRate: number;
  freeShippingThreshold: number;
  enableFreeShipping: boolean;
  estimatedDays: number;
  estimatedDaysMax: number;
  shippingNote: string;
  zones: ShippingZone[];
}

const defaultSettings: ShippingData = {
  flatRate: 50,
  freeShippingThreshold: 499,
  enableFreeShipping: true,
  estimatedDays: 5,
  estimatedDaysMax: 7,
  shippingNote: "Ships within 2-3 business days",
  zones: [],
};

export default function ShippingSettingsPage() {
  const [settings, setSettings] = useState<ShippingData>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/shipping");
      const json = await res.json();
      if (json.settings) {
        setSettings(json.settings);
      }
    } catch (err) {
      console.error("Failed to load shipping settings:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/shipping", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to save settings");
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  const addZone = () => {
    setSettings({
      ...settings,
      zones: [
        ...settings.zones,
        { name: "", states: [], rate: 0, estimatedDays: 7 },
      ],
    });
  };

  const removeZone = (index: number) => {
    const updated = settings.zones.filter((_, i) => i !== index);
    setSettings({ ...settings, zones: updated });
  };

  const updateZone = (index: number, field: string, value: any) => {
    const updated = [...settings.zones];
    (updated[index] as any)[field] = value;
    setSettings({ ...settings, zones: updated });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="h-7 w-7 text-emerald-500" />
            Shipping Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure shipping rates, delivery times, and zones
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {saving ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : saved ? (
            <CheckCircle className="h-4 w-4 mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Settings"}
        </Button>
      </div>

      {/* General Settings */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-500" />
            General Shipping
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-foreground">
                Flat Shipping Rate (₹)
              </Label>
              <Input
                type="number"
                min="0"
                value={settings.flatRate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    flatRate: parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Default shipping charge applied to all orders
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">
                Free Shipping Threshold (₹)
              </Label>
              <Input
                type="number"
                min="0"
                value={settings.freeShippingThreshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    freeShippingThreshold:
                      parseFloat(e.target.value) || 0,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Orders above this amount get free shipping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enableFree"
              checked={settings.enableFreeShipping}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  enableFreeShipping: e.target.checked,
                })
              }
              className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
            />
            <Label htmlFor="enableFree" className="text-foreground cursor-pointer">
              Enable free shipping on orders above threshold
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Times */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Delivery Estimates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-foreground">
                Min Estimated Days
              </Label>
              <Input
                type="number"
                min="1"
                value={settings.estimatedDays}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    estimatedDays: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">
                Max Estimated Days
              </Label>
              <Input
                type="number"
                min="1"
                value={settings.estimatedDaysMax}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    estimatedDaysMax: parseInt(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Shipping Note</Label>
            <Textarea
              value={settings.shippingNote}
              onChange={(e) =>
                setSettings({ ...settings, shippingNote: e.target.value })
              }
              placeholder="Displayed to customers at checkout..."
              className="resize-none"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              This message is shown to customers on the product and checkout pages
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4 border border-border">
            <p className="text-sm text-foreground">
              <strong>Preview:</strong> Estimated delivery in{" "}
              <span className="text-emerald-600 font-semibold">
                {settings.estimatedDays}-{settings.estimatedDaysMax} business
                days
              </span>
            </p>
            {settings.shippingNote && (
              <p className="text-xs text-muted-foreground mt-1">
                {settings.shippingNote}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Shipping Zones */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-foreground flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-500" />
            Shipping Zones
          </CardTitle>
          <Button
            onClick={addZone}
            size="sm"
            variant="outline"
            className="border-emerald-300 text-emerald-600 hover:bg-emerald-50"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Zone
          </Button>
        </CardHeader>
        <CardContent>
          {settings.zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No shipping zones configured</p>
              <p className="text-xs mt-1">
                Add zones to set different rates for different regions
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {settings.zones.map((zone, index) => (
                <div
                  key={index}
                  className="bg-muted border border-border rounded-lg p-4 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">
                      Zone #{index + 1}
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeZone(index)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Zone Name
                      </Label>
                      <Input
                        value={zone.name}
                        onChange={(e) =>
                          updateZone(index, "name", e.target.value)
                        }
                        placeholder="e.g. North India"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Shipping Rate (₹)
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={zone.rate}
                        onChange={(e) =>
                          updateZone(
                            index,
                            "rate",
                            parseFloat(e.target.value) || 0
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">
                        Est. Delivery (days)
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        value={zone.estimatedDays}
                        onChange={(e) =>
                          updateZone(
                            index,
                            "estimatedDays",
                            parseInt(e.target.value) || 1
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">
                      States (comma-separated)
                    </Label>
                    <Input
                      value={zone.states.join(", ")}
                      onChange={(e) =>
                        updateZone(
                          index,
                          "states",
                          e.target.value
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean)
                        )
                      }
                      placeholder="e.g. Delhi, Haryana, Punjab, Uttar Pradesh"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
