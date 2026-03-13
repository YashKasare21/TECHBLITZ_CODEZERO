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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { UserPlus, MagnifyingGlass, Users, CircleDashed, Trash } from "@phosphor-icons/react";
import type { Patient } from "@/lib/types";

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  async function handleDeletePatient() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) {
        const message = error.message.toLowerCase();

        if (
          error.code === "23503" ||
          message.includes("foreign key") ||
          message.includes("violates foreign key constraint")
        ) {
          toast.error("Cannot delete this patient because they have appointment history");
        } else {
          toast.error(error.message);
        }

        return;
      }

      toast.success("Patient deleted successfully");
      await fetchPatients();
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CircleDashed className="h-6 w-6 animate-spin" />
                      <span className="text-sm">Loading patients…</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Users className="h-10 w-10 opacity-30" weight="duotone" />
                      <p className="text-sm font-medium">No patients found</p>
                      <p className="text-xs opacity-60">
                        {search ? "Try a different search term" : "Add your first patient to get started"}
                      </p>
                    </div>
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
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash className="h-3.5 w-3.5" />
                        Delete
                      </Button>
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

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the patient record if it has no linked appointments.
              Patients with appointment history cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeletePatient();
              }}
              disabled={deleting}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <CircleDashed className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
            {saving ? (
              <>
                <CircleDashed className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Add Patient"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
