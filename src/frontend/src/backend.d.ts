import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UpdateEntry {
    kw: bigint;
    entryType: EntryType;
    days: number;
    year: bigint;
    employeeId: bigint;
    projectId?: bigint;
    notes: string;
}
export interface Entry {
    id: bigint;
    kw: bigint;
    entryType: EntryType;
    days: number;
    year: bigint;
    employeeId: bigint;
    projectId?: bigint;
    notes: string;
}
export interface Employee {
    id: bigint;
    pensum: bigint;
    name: string;
    isActive: boolean;
}
export interface Project {
    id: bigint;
    name: string;
    color: string;
    isActive: boolean;
}
export interface Holiday {
    id: bigint;
    kw: bigint;
    name: string;
    year: bigint;
}
export interface UserProfile {
    name: string;
}
export interface UpdateProject {
    name: string;
    color: string;
    isActive: boolean;
}
export enum EntryType {
    projekteinsatz = "projekteinsatz",
    ferien = "ferien",
    absenz = "absenz",
    feiertag = "feiertag"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addTrustedAdminPrincipal(newPrincipal: Principal): Promise<void>;
    applyHolidaysToAllEmployees(year: bigint): Promise<void>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    createOrUpdateEmployee(id: bigint, name: string, pensum: bigint, isActive: boolean): Promise<bigint>;
    createOrUpdateHoliday(id: bigint, name: string, kw: bigint, year: bigint): Promise<bigint>;
    getAllEmployees(): Promise<Array<Employee>>;
    getAllEntries(): Promise<Array<Entry>>;
    getAllHolidays(): Promise<Array<Holiday>>;
    getAllProjects(): Promise<Array<Project>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getEmployee(id: bigint): Promise<Employee | null>;
    getEntriesForEmployeeYear(employeeId: bigint, year: bigint): Promise<Array<Entry>>;
    getEntriesForYear(year: bigint): Promise<Array<Entry>>;
    getEntry(id: bigint): Promise<Entry | null>;
    getHoliday(id: bigint): Promise<Holiday | null>;
    getHolidaysForYear(year: bigint): Promise<Array<Holiday>>;
    getProject(id: bigint): Promise<Project | null>;
    getTrustedAdminPrincipals(): Promise<Array<Principal>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    registerAsTrustedAdmin(): Promise<void>;
    removeTrustedAdminPrincipal(principal: Principal): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    seedSampleData(): Promise<void>;
    upsertEntry(id: bigint, entryData: UpdateEntry): Promise<bigint>;
    upsertProject(id: bigint, projectUpdate: UpdateProject): Promise<bigint>;
}
