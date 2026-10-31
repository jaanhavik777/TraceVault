
"use client";

import { useEffect, useState } from "react";

type User = {
  user_id: number;
  role_id: number;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

type Service = {
  service_id: number;
  service_name: string;
  description: string | null;
  criticality: string;
  service_status: string;
  owner_id: number | null;
};

type Dependency = {
  dependency_id: number;
  service_id: number;
  service_name: string;
  depends_on_service_id: number;
  depends_on_service_name: string;
};

type Tab = "users" | "services" | "dependencies";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [userForm, setUserForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role_id: "2",
  });

  const [serviceForm, setServiceForm] = useState({
    service_name: "",
    description: "",
    criticality: "MEDIUM",
    service_status: "ACTIVE",
    owner_id: "",
  });

  const [editingService, setEditingService] = useState<number | null>(null);

  const [dependencyForm, setDependencyForm] = useState({
    serviceId: "",
    dependsOnServiceId: "",
  });

  async function apiRequest(url: string, options?: RequestInit) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    return data;
  }

  async function loadUsers() {
    const data = await apiRequest("/api/users");
    setUsers(data.users);
  }

  async function loadServices() {
    const data = await apiRequest("/api/services");
    setServices(data.services);
  }

  async function loadDependencies() {
    const data = await apiRequest("/api/dependencies");
    setDependencies(data.dependencies);
  }

  async function refreshData() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (activeTab === "users") await loadUsers();
      if (activeTab === "services") await loadServices();
      if (activeTab === "dependencies") {
        await Promise.all([loadDependencies(), loadServices()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshData();
  }, [activeTab]);

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          ...userForm,
          role_id: Number(userForm.role_id),
        }),
      });

      setUserForm({
        full_name: "",
        email: "",
        password: "",
        role_id: "2",
      });

      setMessage("User created successfully.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user");
    }
  }

  async function toggleUser(user: User) {
    setError("");
    setMessage("");

    try {
      await apiRequest("/api/users", {
        method: "PATCH",
        body: JSON.stringify({
          user_id: user.user_id,
          is_active: !user.is_active,
        }),
      });

      setMessage("User status updated successfully.");
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update user");
    }
  }

  async function saveService(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const payload = {
        ...serviceForm,
        owner_id: serviceForm.owner_id
          ? Number(serviceForm.owner_id)
          : null,
      };

      if (editingService !== null) {
        await apiRequest("/api/services", {
          method: "PATCH",
          body: JSON.stringify({
            service_id: editingService,
            ...payload,
          }),
        });
        setMessage("Service updated successfully.");
      } else {
        await apiRequest("/api/services", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage("Service created successfully.");
      }

      setEditingService(null);
      setServiceForm({
        service_name: "",
        description: "",
        criticality: "MEDIUM",
        service_status: "ACTIVE",
        owner_id: "",
      });

      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save service");
    }
  }

  function editService(service: Service) {
    setEditingService(service.service_id);
    setServiceForm({
      service_name: service.service_name,
      description: service.description || "",
      criticality: service.criticality,
      service_status: service.service_status,
      owner_id: service.owner_id?.toString() || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addDependency(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      await apiRequest("/api/dependencies", {
        method: "POST",
        body: JSON.stringify({
          serviceId: Number(dependencyForm.serviceId),
          dependsOnServiceId: Number(dependencyForm.dependsOnServiceId),
        }),
      });

      setDependencyForm({
        serviceId: "",
        dependsOnServiceId: "",
      });

      setMessage("Dependency added successfully.");
      await loadDependencies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add dependency");
    }
  }

  async function deleteDependency(id: number) {
    if (!window.confirm("Are you sure you want to remove this dependency?")) {
      return;
    }

    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/dependencies?dependency_id=${id}`, {
        method: "DELETE",
      });

      setMessage("Dependency deleted successfully.");
      await loadDependencies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete dependency");
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "users", label: "Users" },
    { id: "services", label: "Services" },
    { id: "dependencies", label: "Dependencies" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
            TraceVault Administration
          </p>
          <h1 className="mt-2 text-3xl font-bold">Admin Dashboard</h1>
          <p className="mt-2 text-slate-500">
            Manage users, services and service dependencies.
          </p>
        </header>

        <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-5 py-3 text-sm font-semibold ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {loading && (
          <p className="mb-4 text-sm text-slate-500">Loading data...</p>
        )}

        {activeTab === "users" && (
          <section className="grid gap-6 lg:grid-cols-[350px_1fr]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold">Create User</h2>

              <form onSubmit={createUser} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Full name
                  </label>
                  <input
                    required
                    maxLength={100}
                    value={userForm.full_name}
                    onChange={(e) =>
                      setUserForm({ ...userForm, full_name: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2"
                    placeholder="Enter full name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    required
                    type="email"
                    maxLength={150}
                    value={userForm.email}
                    onChange={(e) =>
                      setUserForm({ ...userForm, email: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2"
                    placeholder="name@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Password
                  </label>
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={userForm.password}
                    onChange={(e) =>
                      setUserForm({ ...userForm, password: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Role
                  </label>
                  <select
                    value={userForm.role_id}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role_id: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 p-2"
                  >
                    <option value="2">Engineer</option>
                    <option value="1">Admin</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                >
                  Create User
                </button>
              </form>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b p-5">
                <h2 className="text-lg font-bold">User Management</h2>
                <span className="text-sm text-slate-500">
                  {users.length} users
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.user_id} className="border-t">
                        <td className="p-4 font-medium">{user.full_name}</td>
                        <td className="p-4">{user.email}</td>
                        <td className="p-4">
                          {user.role_id === 1 ? "Admin" : "Engineer"}
                        </td>
                        <td className="p-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              user.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => toggleUser(user)}
                            className="font-semibold text-indigo-600 hover:underline"
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}

                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {activeTab === "services" && (
  <section className="space-y-6">

    {/* Create / Edit Service Form */}
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-bold">
        {editingService !== null ? "Edit Service" : "Create Service"}
      </h2>

      <form onSubmit={saveService} className="grid gap-4 md:grid-cols-2">

        <div>
          <label className="mb-1 block text-sm font-medium">
            Service Name
          </label>
          <input
            required
            maxLength={100}
            value={serviceForm.service_name}
            onChange={(e) =>
              setServiceForm({
                ...serviceForm,
                service_name: e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 p-2"
            placeholder="Enter service name"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Criticality
          </label>
          <select
            value={serviceForm.criticality}
            onChange={(e) =>
              setServiceForm({
                ...serviceForm,
                criticality: e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 p-2"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Service Status
          </label>
          <select
            value={serviceForm.service_status}
            onChange={(e) =>
              setServiceForm({
                ...serviceForm,
                service_status: e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 p-2"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Owner ID (optional)
          </label>
          <input
            type="number"
            min="1"
            value={serviceForm.owner_id}
            onChange={(e) =>
              setServiceForm({
                ...serviceForm,
                owner_id: e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 p-2"
            placeholder="Enter owner user ID"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            value={serviceForm.description}
            onChange={(e) =>
              setServiceForm({
                ...serviceForm,
                description: e.target.value,
              })
            }
            rows={3}
            className="w-full rounded-lg border border-slate-300 p-2"
            placeholder="Describe the service..."
          />
        </div>

        <div className="flex gap-3 md:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700"
          >
            {editingService !== null ? "Update Service" : "Create Service"}
          </button>

          {editingService !== null && (
            <button
              type="button"
              onClick={() => {
                setEditingService(null);
                setServiceForm({
                  service_name: "",
                  description: "",
                  criticality: "MEDIUM",
                  service_status: "ACTIVE",
                  owner_id: "",
                });
              }}
              className="rounded-lg border border-slate-300 px-5 py-2"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>

    {/* Service List */}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b p-5">
        <h2 className="text-lg font-bold">Service Management</h2>
        <span className="text-sm text-slate-500">
          {services.length} services
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-4">Service ID</th>
              <th className="p-4">Service Name</th>
              <th className="p-4">Description</th>
              <th className="p-4">Criticality</th>
              <th className="p-4">Status</th>
              <th className="p-4">Owner ID</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {services.map((service) => (
              <tr key={service.service_id} className="border-t">
                <td className="p-4">{service.service_id}</td>

                <td className="p-4 font-medium">
                  {service.service_name}
                </td>

                <td className="p-4">
                  {service.description || "—"}
                </td>

                <td className="p-4">
                  <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-700">
                    {service.criticality}
                  </span>
                </td>

                <td className="p-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      service.service_status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {service.service_status}
                  </span>
                </td>

                <td className="p-4">
                  {service.owner_id ?? "—"}
                </td>

                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => editService(service)}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}

            {services.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-slate-500"
                >
                  No services found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>
)}

        {activeTab === "dependencies" && (
  <section className="space-y-6">

    {/* Add Dependency */}
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-bold">Add Service Dependency</h2>

      <form onSubmit={addDependency} className="grid gap-4 md:grid-cols-2">

        <div>
          <label className="mb-1 block text-sm font-medium">
            Service
          </label>
          <select
            required
            value={dependencyForm.serviceId}
            onChange={(e) =>
              setDependencyForm({
                ...dependencyForm,
                serviceId: e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 p-2"
          >
            <option value="">Select a service</option>
            {services.map((service) => (
              <option
                key={service.service_id}
                value={service.service_id}
              >
                {service.service_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Depends On
          </label>
          <select
            required
            value={dependencyForm.dependsOnServiceId}
            onChange={(e) =>
              setDependencyForm({
                ...dependencyForm,
                dependsOnServiceId: e.target.value,
              })
            }
            className="w-full rounded-lg border border-slate-300 p-2"
          >
            <option value="">Select a dependency</option>
            {services.map((service) => (
              <option
                key={service.service_id}
                value={service.service_id}
              >
                {service.service_name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={
              !dependencyForm.serviceId ||
              !dependencyForm.dependsOnServiceId
            }
            className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Add Dependency
          </button>
        </div>
      </form>
    </div>

    {/* Dependency List */}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b p-5">
        <h2 className="text-lg font-bold">Service Dependencies</h2>
        <span className="text-sm text-slate-500">
          {dependencies.length} dependencies
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-4">Dependency ID</th>
              <th className="p-4">Service</th>
              <th className="p-4">Depends On</th>
              <th className="p-4">Relationship</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {dependencies.map((dependency) => (
              <tr key={dependency.dependency_id} className="border-t">
                <td className="p-4">{dependency.dependency_id}</td>

                <td className="p-4 font-medium">
                  {dependency.service_name}
                </td>

                <td className="p-4">
                  {dependency.depends_on_service_name}
                </td>

                <td className="p-4 font-semibold text-indigo-600">
                  {dependency.service_name} →{" "}
                  {dependency.depends_on_service_name}
                </td>

                <td className="p-4">
                  <button
                    type="button"
                    onClick={() =>
                      deleteDependency(dependency.dependency_id)
                    }
                    className="font-semibold text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}

            {dependencies.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-slate-500"
                >
                  No dependencies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>
)}
      </div>
    </main>
  );
}
