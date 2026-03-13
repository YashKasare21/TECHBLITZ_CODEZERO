"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from "sonner";
import {
  UserPlus,
  MagnifyingGlass,
  Stethoscope,
  UsersThree,
  CircleDashed,
  ToggleLeft,
  PencilSimple,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";

interface DoctorExtra {
  id: string;
  specialization: string;
  bio: string | null;
  consultation_duration_mins: number;
  is_active: boolean;
}

interface StaffUser {
  id: string;
  full_name: string;
  role: "doctor" | "receptionist";
  phone: string | null;
  created_at: string;
  doctor: DoctorExtra | null;
}

const SPECIALIZATIONS = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Urology",
  "Other",
];

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffUser | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StaffUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const doctors = users.filter((u) => u.role === "doctor");
  const receptionists = users.filter((u) => u.role === "receptionist");

  function filterList(list: StaffUser[]) {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q)) ||
        (u.role === "doctor" && u.doctor?.specialization.toLowerCase().includes(q))
    );
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    const res = await fetch(`/api/users?id=${deactivateTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to deactivate user");
    } else {
      toast.success(`${deactivateTarget.full_name} has been deactivated`);
      fetchUsers();
    }
    setDeactivateTarget(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Users</h1>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="gap-2 font-semibold uppercase tracking-wide"
        >
          <UserPlus className="h-4 w-4" weight="bold" />
          Add User
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, or specialization..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-accent pl-9"
        />
      </div>

      <Tabs defaultValue="doctors">
        <TabsList>
          <TabsTrigger value="doctors" className="gap-1.5">
            <Stethoscope className="h-4 w-4" weight="duotone" />
            Doctors
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[11px]">
              {doctors.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="receptionists" className="gap-1.5">
            <UsersThree className="h-4 w-4" weight="duotone" />
            Receptionists
            <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[11px]">
              {receptionists.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Doctors Tab */}
        <TabsContent value="doctors" className="mt-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead>Slot Duration</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingRow colSpan={6} />
                  ) : filterList(doctors).length === 0 ? (
                    <EmptyRow
                      colSpan={6}
                      icon={<Stethoscope className="h-10 w-10 opacity-30" weight="duotone" />}
                      message={search ? "No doctors match your search" : "No doctors added yet"}
                    />
                  ) : (
                    filterList(doctors).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.doctor?.specialization || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.doctor?.consultation_duration_mins ?? 30} mins
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.phone || "—"}
                        </TableCell>
                        <TableCell>
                          {u.doctor?.is_active !== false ? (
                            <Badge className="bg-success/15 text-success hover:bg-success/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => setEditTarget(u)}
                            >
                              <PencilSimple className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            {u.doctor?.is_active !== false && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1 text-destructive hover:bg-destructive/10"
                                onClick={() => setDeactivateTarget(u)}
                              >
                                <ToggleLeft className="h-3.5 w-3.5" />
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receptionists Tab */}
        <TabsContent value="receptionists" className="mt-4">
          <Card className="border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <LoadingRow colSpan={4} />
                  ) : filterList(receptionists).length === 0 ? (
                    <EmptyRow
                      colSpan={4}
                      icon={<UsersThree className="h-10 w-10 opacity-30" weight="duotone" />}
                      message={
                        search ? "No receptionists match your search" : "No receptionists added yet"
                      }
                    />
                  ) : (
                    filterList(receptionists).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {u.phone || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => setEditTarget(u)}
                            >
                              <PencilSimple className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeactivateTarget(u)}
                            >
                              <ToggleLeft className="h-3.5 w-3.5" />
                              Deactivate
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <AddUserDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onCreated={fetchUsers}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        user={editTarget}
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSaved={fetchUsers}
      />

      {/* Deactivate Confirmation */}
      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {deactivateTarget?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.role === "doctor"
                ? "This doctor will be marked inactive and won't appear in booking flows. Their appointment history is preserved."
                : "This receptionist's account will be disabled and they won't be able to log in."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Add User Dialog ────────────────────────────────────────────────────────

function AddUserDialog({
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
    email: "",
    password: "",
    phone: "",
    role: "doctor" as "doctor" | "receptionist",
    specialization: "",
    bio: "",
    consultation_duration_mins: "30",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function reset() {
    setForm({
      full_name: "",
      email: "",
      password: "",
      phone: "",
      role: "doctor",
      specialization: "",
      bio: "",
      consultation_duration_mins: "30",
    });
    setShowPassword(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        role: form.role,
        ...(form.role === "doctor" && {
          specialization: form.specialization,
          bio: form.bio.trim() || undefined,
          consultation_duration_mins: parseInt(form.consultation_duration_mins, 10),
        }),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(data.error || "Failed to create user");
      return;
    }

    toast.success(`${form.full_name} has been added as a ${form.role}`);
    onCreated();
    onOpenChange(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a login account for a doctor or receptionist.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div className="space-y-2">
            <Label>Role *</Label>
            <div className="flex gap-2">
              {(["doctor", "receptionist"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => set("role", r)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    form.role === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-accent text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {r === "doctor" ? (
                    <Stethoscope className="h-4 w-4" weight="duotone" />
                  ) : (
                    <UsersThree className="h-4 w-4" weight="duotone" />
                  )}
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Common fields */}
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder={form.role === "doctor" ? "Dr. Jane Smith" : "Alex Johnson"}
              className="bg-accent"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="user@clinic.com"
                className="bg-accent"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+91 98765 43210"
                className="bg-accent"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Minimum 6 characters"
                className="bg-accent pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeSlash className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Doctor-only fields */}
          {form.role === "doctor" && (
            <>
              <div className="space-y-2">
                <Label>Specialization *</Label>
                <Select
                  value={form.specialization}
                  onValueChange={(v) => set("specialization", v)}
                  required
                >
                  <SelectTrigger className="bg-accent">
                    <SelectValue placeholder="Select specialization" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIZATIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Slot Duration (mins)</Label>
                  <Select
                    value={form.consultation_duration_mins}
                    onValueChange={(v) => set("consultation_duration_mins", v)}
                  >
                    <SelectTrigger className="bg-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 15, 20, 30, 45, 60].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} mins
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Input
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    placeholder="Brief description"
                    className="bg-accent"
                  />
                </div>
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={saving || (form.role === "doctor" && !form.specialization)}
            className="w-full font-semibold uppercase tracking-wide"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <CircleDashed className="h-4 w-4 animate-spin" />
                Creating...
              </span>
            ) : (
              `Add ${form.role.charAt(0).toUpperCase() + form.role.slice(1)}`
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit User Dialog ────────────────────────────────────────────────────────

function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: {
  user: StaffUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    specialization: "",
    bio: "",
    consultation_duration_mins: "30",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name,
        phone: user.phone || "",
        specialization: user.doctor?.specialization || "",
        bio: user.doctor?.bio || "",
        consultation_duration_mins: String(user.doctor?.consultation_duration_mins ?? 30),
      });
    }
  }, [user]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const res = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        ...(user.role === "doctor" && {
          specialization: form.specialization,
          bio: form.bio.trim() || null,
          consultation_duration_mins: parseInt(form.consultation_duration_mins, 10),
        }),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(data.error || "Failed to update user");
      return;
    }

    toast.success("User updated successfully");
    onSaved();
    onOpenChange(false);
  }

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {user.full_name}</DialogTitle>
          <DialogDescription>
            Update profile details for this {user.role}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              className="bg-accent"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="bg-accent"
            />
          </div>

          {user.role === "doctor" && (
            <>
              <div className="space-y-2">
                <Label>Specialization *</Label>
                <Select
                  value={form.specialization}
                  onValueChange={(v) => set("specialization", v)}
                >
                  <SelectTrigger className="bg-accent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIALIZATIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Slot Duration (mins)</Label>
                  <Select
                    value={form.consultation_duration_mins}
                    onValueChange={(v) => set("consultation_duration_mins", v)}
                  >
                    <SelectTrigger className="bg-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[10, 15, 20, 30, 45, 60].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} mins
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Input
                    value={form.bio}
                    onChange={(e) => set("bio", e.target.value)}
                    className="bg-accent"
                  />
                </div>
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full font-semibold uppercase tracking-wide"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <CircleDashed className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function LoadingRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <CircleDashed className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyRow({
  colSpan,
  icon,
  message,
}: {
  colSpan: number;
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-12 text-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          {icon}
          <p className="text-sm font-medium">{message}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
