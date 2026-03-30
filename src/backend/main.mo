import Nat "mo:core/Nat";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";

import MixinAuthorization "authorization/MixinAuthorization";



actor {
  module Employee {
    public type Employee = {
      id : Nat;
      name : Text;
      pensum : Nat;
      isActive : Bool;
    };

    public func compare(e1 : Employee, e2 : Employee) : Order.Order {
      Nat.compare(e1.id, e2.id);
    };
  };

  type Employee = Employee.Employee;

  module Project {
    public type Project = {
      id : Nat;
      name : Text;
      color : Text;
      isActive : Bool;
    };

    public type UpdateProject = {
      name : Text;
      color : Text;
      isActive : Bool;
    };

    public func compare(p1 : Project, p2 : Project) : Order.Order {
      Nat.compare(p1.id, p2.id);
    };
  };

  type Project = Project.Project;

  module Entry {
    public type Entry = {
      id : Nat;
      employeeId : Nat;
      entryType : EntryType;
      kw : Nat;
      year : Nat;
      projectId : ?Nat;
      notes : Text;
      days : Float;
    };

    public type UpdateEntry = {
      employeeId : Nat;
      entryType : EntryType;
      kw : Nat;
      year : Nat;
      projectId : ?Nat;
      notes : Text;
      days : Float;
    };

    public func compare(e1 : Entry, e2 : Entry) : Order.Order {
      Nat.compare(e1.id, e2.id);
    };
  };

  type Entry = Entry.Entry;

  module Holiday {
    public type Holiday = {
      id : Nat;
      name : Text;
      kw : Nat;
      year : Nat;
    };
    public func compare(h1 : Holiday, h2 : Holiday) : Order.Order {
      Nat.compare(h1.id, h2.id);
    };
  };

  type Holiday = Holiday.Holiday;

  type EntryType = {
    #feiertag;
    #ferien;
    #absenz;
    #projekteinsatz;
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  var nextEmployeeId = 1;
  var nextProjectId = 1;
  var nextEntryId = 1;
  var nextHolidayId = 1;

  let employees = Map.empty<Nat, Employee>();
  let projects = Map.empty<Nat, Project>();
  let entries = Map.empty<Nat, Entry>();
  let holidays = Map.empty<Nat, Holiday>();

  let trustedAdminPrincipals = Map.empty<Principal, Bool>();

  public shared ({ caller }) func addTrustedAdminPrincipal(newPrincipal : Principal) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can add trusted admin principals");
    };
    trustedAdminPrincipals.add(newPrincipal, true);
  };

  public shared ({ caller }) func removeTrustedAdminPrincipal(principal : Principal) : async () {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can remove trusted admin principals");
    };
    trustedAdminPrincipals.remove(principal);
  };

  public query ({ caller }) func getTrustedAdminPrincipals() : async [Principal] {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can see trusted admin principals");
    };
    trustedAdminPrincipals.keys().toArray();
  };

  public shared ({ caller }) func registerAsTrustedAdmin() : async () {
    if (trustedAdminPrincipals.containsKey(caller)) {
      accessControlState.userRoles.add(caller, #admin);
      accessControlState.adminAssigned := true;
    };
  };

  public type UserProfile = {
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func createOrUpdateEmployee(id : Nat, name : Text, pensum : Nat, isActive : Bool) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can modify employees");
    };
    if (id == 0) {
      let newId = nextEmployeeId;
      nextEmployeeId += 1;
      let employee : Employee = { id = newId; name; pensum; isActive };
      employees.add(newId, employee);
      return newId;
    } else {
      let employee : Employee = { id; name; pensum; isActive };
      employees.add(id, employee);
      return id;
    };
  };

  public query ({ caller }) func getEmployee(id : Nat) : async ?Employee {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view employees");
    };
    employees.get(id);
  };

  public query ({ caller }) func getAllEmployees() : async [Employee] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view employees");
    };
    employees.values().toArray().sort();
  };

  public shared ({ caller }) func upsertProject(id : Nat, projectUpdate : Project.UpdateProject) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can modify projects");
    };
    let projectId = if (id == 0) {
      let newId = nextProjectId;
      nextProjectId += 1;
      newId;
    } else {
      id;
    };

    let project : Project = {
      projectUpdate with
      id = projectId;
    };

    projects.add(projectId, project);
    projectId;
  };

  public query ({ caller }) func getProject(id : Nat) : async ?Project {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view projects");
    };
    projects.get(id);
  };

  public query ({ caller }) func getAllProjects() : async [Project] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view projects");
    };
    projects.values().toArray().sort();
  };

  public shared ({ caller }) func upsertEntry(id : Nat, entryData : Entry.UpdateEntry) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can modify entries");
    };
    let entryId = if (id == 0) {
      let newId = nextEntryId;
      nextEntryId += 1;
      newId;
    } else {
      id;
    };

    let entry : Entry = {
      entryData with
      id = entryId;
    };

    entries.add(entryId, entry);
    entryId;
  };

  public query ({ caller }) func getEntry(id : Nat) : async ?Entry {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view entries");
    };
    entries.get(id);
  };

  public query ({ caller }) func getAllEntries() : async [Entry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view entries");
    };
    entries.values().toArray().sort();
  };

  public shared ({ caller }) func createOrUpdateHoliday(id : Nat, name : Text, kw : Nat, year : Nat) : async Nat {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can modify holidays");
    };
    let holidayId = if (id == 0) {
      let newId = nextHolidayId;
      nextHolidayId += 1;
      newId;
    } else {
      id;
    };

    let holiday : Holiday = {
      id = holidayId;
      name;
      kw;
      year;
    };

    holidays.add(holidayId, holiday);
    holidayId;
  };

  public query ({ caller }) func getHoliday(id : Nat) : async ?Holiday {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view holidays");
    };
    holidays.get(id);
  };

  public query ({ caller }) func getAllHolidays() : async [Holiday] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view holidays");
    };
    holidays.values().toArray().sort();
  };

  public query ({ caller }) func getEntriesForEmployeeYear(employeeId : Nat, year : Nat) : async [Entry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view entries");
    };
    entries.values().toArray().filter(func(e) { e.employeeId == employeeId and e.year == year }).sort();
  };

  public query ({ caller }) func getEntriesForYear(year : Nat) : async [Entry] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view entries");
    };
    entries.values().toArray().filter(func(e) { e.year == year }).sort();
  };

  public query ({ caller }) func getHolidaysForYear(year : Nat) : async [Holiday] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view holidays");
    };
    holidays.values().toArray().filter(func(h) { h.year == year }).sort();
  };

  public shared ({ caller }) func applyHolidaysToAllEmployees(year : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can apply holidays to all employees");
    };

    // Collect entries to keep (not feiertag for this year)
    let toKeep = entries.entries().toArray().filter(
      func((_, entry) : (Nat, Entry)) : Bool {
        not (entry.entryType == #feiertag and entry.year == year)
      }
    );
    entries.clear();
    for ((k, v) in toKeep.values()) {
      entries.add(k, v);
    };

    let yearHolidays = holidays.values().toArray().filter(func(h) { h.year == year }).sort();
    let allEmployees = employees.values().toArray().sort();

    for (holiday in yearHolidays.values()) {
      for (employee in allEmployees.values()) {
        let entry : Entry = {
          id = nextEntryId;
          employeeId = employee.id;
          entryType = #feiertag;
          kw = holiday.kw;
          year;
          projectId = null;
          notes = holiday.name;
          days = 5;
        };
        entries.add(nextEntryId, entry);
        nextEntryId += 1;
      };
    };
  };

  public shared ({ caller }) func seedSampleData() : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can seed sample data");
    };
    employees.clear();
    let empName = func(i : Nat) : Text { "Mitarbeiter " # i.toText() };
    for (i in Nat.range(1, 7)) {
      let employee : Employee = {
        id = i;
        name = empName(i);
        pensum = 50 + 10 * i;
        isActive = true;
      };
      employees.add(i, employee);
    };
    nextEmployeeId := 7;

    projects.clear();
    for (i in Nat.range(1, 5)) {
      let project : Project = {
        id = i;
        name = "Projekt " # i.toText();
        color = "#FF00" # (i * 2).toText();
        isActive = true;
      };
      projects.add(i, project);
    };
    nextProjectId := 5;

    holidays.clear();
    for (i in Nat.range(1, 11)) {
      let holiday : Holiday = {
        id = i;
        name = "Feiertag " # i.toText();
        kw = 5 + i;
        year = 2024;
      };
      holidays.add(i, holiday);
    };
    nextHolidayId := 11;
  };
};
