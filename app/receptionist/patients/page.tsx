"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { UserPlus, MagnifyingGlass } from "@phosphor-icons/react";
import type { Patient } from "@/lib/types";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const supabase = createClient();

  async function fetchPatients() {
    setLoading(true);
    const { data } = await supabase
      .from("patients")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setPatients(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchPatients();
  }, []);

  const filtered = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.patient_uid.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone && p.phone.includes(search)) ||
      (p.email && p.email.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Patients</h1>
        <Button onClick={() => setDialogOpen(true)} className="gap-2 font-semibold uppercase tracking-wide">
          <UserPlus className="h-4 w-4" weight="bold" />
          Add Patient
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, UID, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-accent pl-9"
        />
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Blood Group</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No patients found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm font-medium text-primary">
                      {p.patient_uid}
                    </TableCell>
                    <TableCell className="font-medium">{p.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.phone || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{p.gender || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.blood_group || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AddPatientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchPatients}
      />
    </div>
  );
}

function AddPatientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    blood_group: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  function handleChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error("Patient name is required");
      return;
    }
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("patients").insert({
      full_name: form.full_name.trim(),
      phone: form.phone || null,
      email: form.email || null,
      dob: form.dob || null,
      gender: form.gender || null,
      blood_group: form.blood_group || null,
      address: form.address || null,
      created_by: userData.user?.id || null,
    });

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Patient added successfully");
    onCreated();
    onOpenChange(false);
    setForm({
      full_name: "",
      phone: "",
      email: "",
      dob: "",
      gender: "",
      blood_group: "",
      address: "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
          <DialogDescription>
            Register a new patient. A unique ID will be generated automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => handleChange("full_name", e.target.value)}
              className="bg-accent"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="bg-accent"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="bg-accent"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={form.dob}
                onChange={(e) => handleChange("dob", e.target.value)}
                className="bg-accent"
              />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => handleChange("gender", v)}
              >
                <SelectTrigger className="bg-accent">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Blood Group</Label>
              <Select
                value={form.blood_group}
                onValueChange={(v) => handleChange("blood_group", v)}
              >
                <SelectTrigger className="bg-accent">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                    <SelectItem key={bg} value={bg}>
                      {bg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              className="bg-accent"
            />
          </div>
          <Button
            type="submit"
            disabled={saving}
            className="w-full font-semibold uppercase tracking-wide"
          >
            {saving ? "Saving..." : "Add Patient"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
