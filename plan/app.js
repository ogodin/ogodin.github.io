const LOCAL_PLACEHOLDER = "— Choisir un local —";
const ALL_TEACHERS_PLACEHOLDER = "— Tous les enseignants —";
const ALL_PROCTORS_PLACEHOLDER = "— Tous les surveillants —";
const COURSE_PLACEHOLDER = "— Choisir un cours —";
const AISLE_GAP = 42;
const REQUIRED_ENCRYPTED_DATA_VERSION = 3;
const DEFAULT_LAYOUT = {
  room: LOCAL_PLACEHOLDER,
  leftRows: 4,
  leftCols: 8,
  middle: false,
  rightRows: 0,
  rightCols: 0,
};

const state = {
  dataLoaded: false,
  sourceData: {
    surveillanceText: "",
    examsText: "",
    teachersText: "",
    roomsData: {},
  },
  roomsConfig: { [LOCAL_PLACEHOLDER]: null },
  model: null,
  teacher: null,
  proctor: null,
  course: null,
  namesText: "",
  layout: normalizeLayout(DEFAULT_LAYOUT),
  options: {
    rooms: [],
    teachers: [],
    proctors: [],
    courses: [],
  },
  blockMode: false,
  selectedSourceIndex: null,
  plan: null,
  error: "",
};

const elements = {
  unlockOverlay: document.getElementById("unlockOverlay"),
  unlockForm: document.getElementById("unlockForm"),
  secretInput: document.getElementById("secretInput"),
  unlockBtn: document.getElementById("unlockBtn"),
  unlockError: document.getElementById("unlockError"),
  teacherSelect: document.getElementById("teacherSelect"),
  proctorSelect: document.getElementById("proctorSelect"),
  courseSelect: document.getElementById("courseSelect"),
  roomSelect: document.getElementById("roomSelect"),
  namesInput: document.getElementById("namesInput"),
  leftRowsInput: document.getElementById("leftRowsInput"),
  leftColsInput: document.getElementById("leftColsInput"),
  rightRowsInput: document.getElementById("rightRowsInput"),
  rightColsInput: document.getElementById("rightColsInput"),
  middleCheckbox: document.getElementById("middleCheckbox"),
  generateBtn: document.getElementById("generateBtn"),
  blockModeBtn: document.getElementById("blockModeBtn"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),
  exportBtn: document.getElementById("exportBtn"),
  studentCount: document.getElementById("studentCount"),
  seatCount: document.getElementById("seatCount"),
  overflowCount: document.getElementById("overflowCount"),
  planSubtitle: document.getElementById("planSubtitle"),
  planGrid: document.getElementById("planGrid"),
};

function normalizeCourseCode(code) {
  return (code || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function normalizeGroupNumber(group) {
  const value = String(group || "").trim();
  return value.replace(/^0+/, "") || value;
}

function courseKey(code, group) {
  const normalizedCode = normalizeCourseCode(code);
  if (!normalizedCode) {
    return "";
  }
  const normalizedGroup = normalizeGroupNumber(group);
  return normalizedGroup ? `${normalizedCode}::${normalizedGroup}` : normalizedCode;
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function deriveDataKey(secret, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );
}

async function decryptEncryptedData(secret) {
  const encryptedData = window.CLASSROOM_PLAN_ENCRYPTED_DATA;
  if (!encryptedData) {
    throw new Error("Le fichier de données chiffrées est absent.");
  }
  if (encryptedData.version !== REQUIRED_ENCRYPTED_DATA_VERSION) {
    throw new Error("Le fichier de données chiffrées est incompatible.");
  }

  if (!window.crypto?.subtle) {
    throw new Error(
      "Le navigateur ne permet pas le déchiffrement Web Crypto dans ce contexte.",
    );
  }

  const salt = base64ToBytes(encryptedData.salt);
  const iv = base64ToBytes(encryptedData.iv);
  const ciphertext = base64ToBytes(encryptedData.ciphertext);
  const key = await deriveDataKey(secret, salt, encryptedData.iterations);
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(plaintextBuffer));
}

function parseDelimited(text, delimiter = ";") {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if (character === "\n" && !inQuotes) {
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    if (character !== "\r") {
      current += character;
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim().replace(/^\ufeff/, ""));
  return rows
    .slice(1)
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) => {
      const record = {};
      headers.forEach((header, columnIndex) => {
        record[header] = values[columnIndex] || "";
      });
      return record;
    });
}

function loadRoomConfigurations(data) {
  const configurations = { [LOCAL_PLACEHOLDER]: null };

  Object.entries(data || {}).forEach(([name, config]) => {
    if (
      name === LOCAL_PLACEHOLDER ||
      !config ||
      !Array.isArray(config.gauche)
    ) {
      return;
    }

    if (config.milieu) {
      if (!Array.isArray(config.droite) || config.droite.length !== 2) {
        return;
      }
      configurations[name] = {
        milieu: true,
        gauche: [Number(config.gauche[0]), Number(config.gauche[1])],
        droite: [Number(config.droite[0]), Number(config.droite[1])],
      };
      return;
    }

    configurations[name] = {
      milieu: false,
      gauche: [Number(config.gauche[0]), Number(config.gauche[1])],
    };
  });

  return configurations;
}

function setCourseTitle(courseTitles, key, title) {
  if (!title) {
    return;
  }
  if (!courseTitles[key] || title.length >= courseTitles[key].length) {
    courseTitles[key] = title;
  }
}

function roomNameFromExamLocal(value) {
  const local = String(value || "").trim();
  const match = local.match(/^SC\s*0*(.+)$/i);
  return match ? match[1] : local;
}

function normalizePersonPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z-]/g, "")
    .toLowerCase();
}

function personLookupKey(name) {
  const [lastName, firstNames = ""] = String(name || "").split(",");
  const firstInitial = normalizePersonPart(firstNames).charAt(0);
  const normalizedLastName = normalizePersonPart(lastName);
  return normalizedLastName && firstInitial
    ? `${normalizedLastName}|${firstInitial}`
    : "";
}

function isAbbreviatedPersonName(name) {
  const [, firstNames = ""] = String(name || "").split(",");
  return normalizePersonPart(firstNames).length === 1;
}

function addFullNameCandidate(index, name) {
  const trimmed = String(name || "").replace(/\s+/g, " ").trim();
  if (!trimmed || isAbbreviatedPersonName(trimmed)) {
    return;
  }

  const key = personLookupKey(trimmed);
  if (!key) {
    return;
  }

  if (!index[key]) {
    index[key] = new Set();
  }
  index[key].add(trimmed);
}

function buildFullNameIndex(surveillanceRows, examRows) {
  const index = {};

  surveillanceRows.forEach((row) => {
    addFullNameCandidate(index, row.NomPrenomProf);
  });

  examRows.forEach((row) => {
    addFullNameCandidate(index, row.NomEnseignant);
    String(row.NomTitulaire || "")
      .split(/[\n;]/)
      .forEach((name) => addFullNameCandidate(index, name));
  });

  return index;
}

function expandAbbreviatedPersonName(name, fullNameIndex) {
  const trimmed = String(name || "").trim();
  if (!isAbbreviatedPersonName(trimmed)) {
    return trimmed;
  }

  const candidates = fullNameIndex[personLookupKey(trimmed)] || new Set();
  return candidates.size === 1 ? [...candidates][0] : trimmed;
}

function buildModel(surveillanceText, examsText, teachersText) {
  const surveillanceRows = parseDelimited(surveillanceText);
  const examRows = parseDelimited(examsText);
  const teacherRows = parseDelimited(teachersText);
  const fullNameIndex = buildFullNameIndex(surveillanceRows, examRows);

  const studentsByGroup = {};
  const groupKeysByCourse = {};
  const teacherData = {};
  const courseTitles = {};
  const courseGroups = {};
  const teacherGroups = {};
  const proctorGroups = {};
  const coursesByProctor = {};
  const proctorsByCourse = {};
  const roomsByGroup = {};

  surveillanceRows.forEach((row) => {
    const course = normalizeCourseCode(row.NumeroCours || "");
    const key = courseKey(row.NumeroCours || "", row.NumeroGroupe || "");
    const group = normalizeGroupNumber(row.NumeroGroupe || "");
    const courseTitle = (row.TitreCours || "").trim();
    const student = (row.NomPrenomEtudiant || "").trim();

    if (!key || !student) {
      return;
    }

    setCourseTitle(courseTitles, course, courseTitle);
    courseGroups[key] = group;
    if (!groupKeysByCourse[course]) {
      groupKeysByCourse[course] = new Set();
    }
    groupKeysByCourse[course].add(key);
    if (!studentsByGroup[key]) {
      studentsByGroup[key] = [];
    }
    studentsByGroup[key].push(student);
  });

  examRows.forEach((row) => {
    const course = normalizeCourseCode(row.NoCours || "");
    const key = courseKey(row.NoCours || "", row.NoGroupe || "");
    const group = normalizeGroupNumber(row.NoGroupe || "");
    const proctor = (row.NomEnseignant || "").trim();
    const room = roomNameFromExamLocal(row.NoLocal || "");

    if (!key || !proctor) {
      return;
    }

    courseGroups[key] = group;
    roomsByGroup[key] = room;

    if (proctor) {
      if (!coursesByProctor[proctor]) {
        coursesByProctor[proctor] = new Set();
      }
      coursesByProctor[proctor].add(course);
      if (!proctorsByCourse[course]) {
        proctorsByCourse[course] = new Set();
      }
      proctorsByCourse[course].add(proctor);
      if (!proctorGroups[proctor]) {
        proctorGroups[proctor] = new Set();
      }
      proctorGroups[proctor].add(key);
    }

  });

  teacherRows.forEach((row) => {
    const course = normalizeCourseCode(
      row["Numéro du cours"] || row["Numero du cours"] || "",
    );
    const courseTitle = (row["Titre du cours"] || "").trim();
    const group = normalizeGroupNumber(row.Numéro || row.Numero || "");
    const key = courseKey(course, group);
    const titulaires = (row.Titulaires || "").trim();

    if (!key || !titulaires) {
      return;
    }

    setCourseTitle(courseTitles, course, courseTitle);
    courseGroups[key] = group;

    titulaires
      .split(/[\n;]/)
      .map((name) => expandAbbreviatedPersonName(name, fullNameIndex))
      .filter(Boolean)
      .forEach((teacher) => {
        if (!teacherData[teacher]) {
          teacherData[teacher] = new Set();
        }
        teacherData[teacher].add(course);
        if (!teacherGroups[teacher]) {
          teacherGroups[teacher] = new Set();
        }
        teacherGroups[teacher].add(key);
      });
  });

  const coursesByTeacher = {};
  const teachersByCourse = {};
  Object.entries(teacherData).forEach(([teacher, courses]) => {
    coursesByTeacher[teacher] = new Set(courses);
    courses.forEach((course) => {
      if (!teachersByCourse[course]) {
        teachersByCourse[course] = new Set();
      }
      teachersByCourse[course].add(teacher);
    });
  });

  const allProctors = new Set(Object.keys(coursesByProctor));
  const allTeachers = new Set(Object.keys(coursesByTeacher));
  const allCourses = new Set(Object.keys(groupKeysByCourse));

  return {
    studentsByGroup,
    groupKeysByCourse,
    teacherData,
    courseTitles,
    courseGroups,
    teacherGroups,
    proctorGroups,
    coursesByProctor,
    proctorsByCourse,
    coursesByTeacher,
    teachersByCourse,
    roomsByGroup,
    allProctors,
    allTeachers,
    allCourses,
  };
}

function getVisibleTeachers(model, proctor, course) {
  const courses = course
    ? new Set([course])
    : new Set(model.allCourses);

  return [...model.allTeachers]
    .filter((teacher) => {
      if (!hasIntersection(model.coursesByTeacher[teacher] || new Set(), courses)) {
        return false;
      }
      if (!proctor) {
        return true;
      }
      return [...courses].some(
        (candidateCourse) => resolveGroupKeysForModel(
          model,
          candidateCourse,
          teacher,
          proctor,
        ).length > 0,
      );
    })
    .sort(localeSort);
}

function getVisibleProctors(model, teacher, course) {
  const courses = course
    ? new Set([course])
    : new Set(model.allCourses);

  return [...model.allProctors]
    .filter((proctor) => {
      if (!hasIntersection(model.coursesByProctor[proctor] || new Set(), courses)) {
        return false;
      }
      if (!teacher) {
        return true;
      }
      return [...courses].some(
        (candidateCourse) => resolveGroupKeysForModel(
          model,
          candidateCourse,
          teacher,
          proctor,
        ).length > 0,
      );
    })
    .sort(localeSort);
}

function getVisibleCourses(model, teacher, proctor) {
  let courses = new Set(model.allCourses);
  if (teacher) {
    courses = intersection(
      courses,
      model.coursesByTeacher[teacher] || new Set(),
    );
  }
  if (proctor) {
    courses = intersection(
      courses,
      model.coursesByProctor[proctor] || new Set(),
    );
  }

  return [...courses]
    .sort((left, right) =>
      localeSort(
        model.courseTitles[left] || left,
        model.courseTitles[right] || right,
      ),
    )
    .map((course) => ({
      code: course,
      title: courseLabel(model, course),
    }));
}

function courseLabel(model, course) {
  return model.courseTitles[course] || course;
}

function sanitizeFilters() {
  if (!state.model) {
    state.options = { rooms: [], teachers: [], proctors: [], courses: [] };
    return;
  }

  let changed = true;
  while (changed) {
    changed = false;

    const teachers = getVisibleTeachers(
      state.model,
      state.proctor,
      state.course,
    );
    if (state.teacher && !teachers.includes(state.teacher)) {
      state.teacher = null;
      changed = true;
    }

    const proctors = getVisibleProctors(
      state.model,
      state.teacher,
      state.course,
    );
    if (state.proctor && !proctors.includes(state.proctor)) {
      state.proctor = null;
      changed = true;
    }

    const courses = getVisibleCourses(
      state.model,
      state.teacher,
      state.proctor,
    );
    if (
      state.course &&
      !courses.some((course) => course.code === state.course)
    ) {
      state.course = null;
      changed = true;
    }
  }

  state.options = {
    rooms: Object.keys(state.roomsConfig)
      .filter((name) => name !== LOCAL_PLACEHOLDER)
      .sort(localeSort),
    teachers: getVisibleTeachers(state.model, state.proctor, state.course),
    proctors: getVisibleProctors(state.model, state.teacher, state.course),
    courses: getVisibleCourses(state.model, state.teacher, state.proctor),
  };
}

function getStudents(course, teacher, proctor) {
  if (!state.model || !course) {
    return [];
  }

  return resolveGroupKeys(course, teacher, proctor)
    .flatMap((key) => state.model.studentsByGroup?.[key] || [])
    .sort(localeSort);
}

function firstSortedSetValue(values) {
  return [...(values || new Set())].sort(localeSort)[0] || null;
}

function resolveGroupKeysForModel(model, course, teacher = null, proctor = null) {
  let keys = new Set(model?.groupKeysByCourse?.[course] || []);
  if (teacher) {
    keys = intersection(keys, model.teacherGroups?.[teacher] || new Set());
  }
  if (proctor) {
    keys = intersection(keys, model.proctorGroups?.[proctor] || new Set());
  }
  return [...keys];
}

function resolveGroupKeys(course, teacher = state.teacher, proctor = state.proctor) {
  return resolveGroupKeysForModel(state.model, course, teacher, proctor);
}

function selectCourseAssignments() {
  if (!state.course || !state.model) {
    state.teacher = null;
    state.proctor = null;
    return;
  }

  const teachers = [...(state.model.teachersByCourse[state.course] || new Set())].sort(localeSort);
  const proctors = [...(state.model.proctorsByCourse[state.course] || new Set())].sort(localeSort);

  if (state.teacher && !teachers.includes(state.teacher)) {
    state.teacher = null;
  }
  if (!state.teacher && teachers.length === 1) {
    state.teacher = teachers[0];
  }

  if (state.proctor && !proctors.includes(state.proctor)) {
    state.proctor = null;
  }
  if (!state.proctor && proctors.length === 1) {
    state.proctor = proctors[0];
  }
}

function applyAutomaticSelections() {
  let changed = true;

  while (changed) {
    changed = false;
    sanitizeFilters();

    const previousTeacher = state.teacher;
    const previousProctor = state.proctor;
    const previousCourse = state.course;

    if (!state.course && state.options.courses.length === 1) {
      state.course = state.options.courses[0].code;
    }

    if (state.course) {
      selectCourseAssignments();
    }

    if (!state.teacher && state.options.teachers.length === 1) {
      state.teacher = state.options.teachers[0];
    }

    if (!state.proctor && state.options.proctors.length === 1) {
      state.proctor = state.options.proctors[0];
    }

    changed =
      previousTeacher !== state.teacher ||
      previousProctor !== state.proctor ||
      previousCourse !== state.course;
  }

  sanitizeFilters();
}

function computeTotalColumns(layout) {
  return layout.middle ? layout.leftCols + layout.rightCols : layout.leftCols;
}

function normalizeLayout(layout) {
  const normalized = {
    room: layout.room || LOCAL_PLACEHOLDER,
    leftRows: Math.max(1, Number(layout.leftRows || 4)),
    leftCols: Math.max(1, Number(layout.leftCols || 8)),
    middle: Boolean(layout.middle),
    rightRows: Math.max(0, Number(layout.rightRows || 0)),
    rightCols: Math.max(0, Number(layout.rightCols || 0)),
  };

  if (normalized.middle) {
    normalized.rightRows = Math.max(1, normalized.rightRows);
    normalized.rightCols = Math.max(1, normalized.rightCols);
  } else {
    normalized.rightRows = 0;
    normalized.rightCols = 0;
  }

  normalized.totalCols = computeTotalColumns(normalized);
  return normalized;
}

function applyRoomConfiguration(roomName) {
  const config = state.roomsConfig[roomName];
  if (!config) {
    state.layout = normalizeLayout({ ...state.layout, room: roomName });
    return;
  }

  state.layout = normalizeLayout({
    room: roomName,
    leftRows: config.gauche[0],
    leftCols: config.gauche[1],
    middle: Boolean(config.milieu),
    rightRows: config.milieu ? config.droite[0] : 0,
    rightCols: config.milieu ? config.droite[1] : 0,
  });
}

function roomForCourse(course) {
  const groupKeys = resolveGroupKeys(course);
  const rooms = [
    ...new Set(
      groupKeys
        .map((key) => state.model?.roomsByGroup?.[key] || "")
        .filter(Boolean),
    ),
  ];

  if (rooms.length !== 1) {
    return LOCAL_PLACEHOLDER;
  }

  const room = rooms[0];
  if (room && state.roomsConfig[room]) {
    return room;
  }
  return state.roomsConfig.GYM ? "GYM" : LOCAL_PLACEHOLDER;
}

function applyRoomFromSelectedCourse() {
  if (!state.course) {
    return;
  }

  const nextRoom = roomForCourse(state.course);
  if (nextRoom === state.layout.room) {
    return;
  }

  applyRoomConfiguration(nextRoom);
  state.selectedSourceIndex = null;
  state.plan = buildEmptyPlan();
}

function updateLayoutFromControls() {
  const previousMiddle = state.layout.middle;
  const nextMiddle = elements.middleCheckbox.checked;

  const nextLayout = {
    room: state.layout.room,
    leftRows: Number(elements.leftRowsInput.value || 1),
    leftCols: Number(elements.leftColsInput.value || 1),
    middle: nextMiddle,
    rightRows: Number(elements.rightRowsInput.value || 0),
    rightCols: Number(elements.rightColsInput.value || 0),
  };

  if (nextMiddle && !previousMiddle) {
    const totalCols = Math.max(
      1,
      state.layout.totalCols || state.layout.leftCols,
    );
    nextLayout.leftCols = Math.ceil(totalCols / 2);
    nextLayout.rightCols = Math.floor(totalCols / 2);
    nextLayout.rightRows = nextLayout.leftRows;
  }

  if (!nextMiddle && previousMiddle) {
    nextLayout.leftCols = state.layout.leftCols + state.layout.rightCols;
    nextLayout.rightRows = 0;
    nextLayout.rightCols = 0;
  }

  state.layout = normalizeLayout(nextLayout);
}

function buildEmptyPlan() {
  const seats = [];
  const layout = state.layout;

  for (let row = 0; row < layout.leftRows; row += 1) {
    for (let col = 0; col < layout.leftCols; col += 1) {
      seats.push({
        index: seats.length,
        section: "left",
        row,
        col,
        displayCol: col,
        name: "",
        blocked: false,
      });
    }
  }

  if (layout.middle && layout.rightCols > 0) {
    const offset = layout.leftCols + 1;
    for (let row = 0; row < layout.rightRows; row += 1) {
      for (let col = 0; col < layout.rightCols; col += 1) {
        seats.push({
          index: seats.length,
          section: "right",
          row,
          col,
          displayCol: offset + col,
          name: "",
          blocked: false,
        });
      }
    }
  }

  return {
    seats,
    seatCount: seats.length,
    overflowCount: 0,
  };
}

function seatKey(seat) {
  return `${seat.section}:${seat.row}:${seat.col}`;
}

function blockedSeatKeys() {
  return new Set(
    (state.plan?.seats || [])
      .filter((seat) => seat.blocked)
      .map(seatKey),
  );
}

function generatePlan({ preserveBlocked = true } = {}) {
  const blockedKeys = preserveBlocked ? blockedSeatKeys() : new Set();
  const plan = buildEmptyPlan();
  const names = getCurrentNames();
  const shuffled = [...names];

  plan.seats.forEach((seat) => {
    seat.blocked = blockedKeys.has(seatKey(seat));
  });

  const shuffledSeatIndexes = plan.seats
    .filter((seat) => !seat.blocked)
    .map((seat) => seat.index);
  shuffle(shuffled);
  shuffle(shuffledSeatIndexes);

  shuffled.forEach((name, index) => {
    const seatIndex = shuffledSeatIndexes[index];
    if (seatIndex === undefined) {
      return;
    }
    plan.seats[seatIndex].name = name;
  });
  plan.overflowCount = Math.max(0, names.length - shuffledSeatIndexes.length);

  state.plan = plan;
  state.selectedSourceIndex = null;
}

function getCurrentNames() {
  return elements.namesInput.value
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function seatVisualState(seat) {
  if (state.selectedSourceIndex === seat.index) {
    return "selected";
  }
  if (seat.blocked) {
    return "blocked";
  }
  if (state.blockMode) {
    return "block-mode";
  }
  if (!seat.name.trim()) {
    return "empty";
  }
  return "normal";
}

function clickSeat(index) {
  const seat = state.plan.seats[index];
  if (!seat) {
    return;
  }

  if (state.blockMode) {
    seat.blocked = !seat.blocked;
    if (seat.blocked && seat.name.trim()) {
      const candidates = state.plan.seats.filter(
        (candidate) =>
          candidate.index !== index &&
          !candidate.blocked &&
          !candidate.name.trim(),
      );
      if (candidates.length) {
        const destination = randomItem(candidates);
        destination.name = seat.name;
        seat.name = "";
      }
    }
    render();
    return;
  }

  if (state.selectedSourceIndex === null) {
    if (!seat.name.trim() || seat.blocked) {
      return;
    }
    state.selectedSourceIndex = index;
    render();
    return;
  }

  if (state.selectedSourceIndex === index) {
    state.selectedSourceIndex = null;
    render();
    return;
  }

  const source = state.plan.seats[state.selectedSourceIndex];
  if (!source || !source.name.trim() || source.blocked) {
    state.selectedSourceIndex = null;
    render();
    return;
  }

  if (!seat.name.trim()) {
    seat.name = source.name;
    source.name = "";
    if (seat.blocked) {
      seat.blocked = false;
    }
    state.selectedSourceIndex = null;
    render();
    return;
  }

  const candidates = state.plan.seats.filter(
    (candidate) =>
      !candidate.blocked &&
      !candidate.name.trim() &&
      candidate.index !== source.index &&
      candidate.index !== seat.index,
  );

  if (!candidates.length) {
    render();
    return;
  }

  const replacement = randomItem(candidates);
  replacement.name = seat.name;
  seat.name = source.name;
  source.name = "";
  seat.blocked = false;
  state.selectedSourceIndex = null;
  render();
}

function gridTemplateColumns() {
  if (state.layout.middle && state.layout.rightCols > 0) {
    return [
      ...Array(state.layout.leftCols).fill("minmax(92px, 1fr)"),
      `${AISLE_GAP}px`,
      ...Array(state.layout.rightCols).fill("minmax(92px, 1fr)"),
    ].join(" ");
  }
  return Array(state.layout.leftCols).fill("minmax(92px, 1fr)").join(" ");
}

function serializeProjectionState() {
  return {
    courseTitle: courseSubtitle(),
    gridTemplateColumns: gridTemplateColumns(),
    seats: state.plan.seats.map((seat) => ({
      name: seat.name,
      row: seat.row,
      displayCol: seat.displayCol,
      state: seatVisualState(seat),
    })),
  };
}

function courseSubtitle() {
  return state.course
    ? courseLabel(state.model, state.course)
    : "Aucun cours sélectionné";
}

function exportPlanAsPng() {
  const layout = state.layout;
  const plan = state.plan;
  const cellWidth = 220;
  const cellHeight = 82;
  const gap = 18;
  const margin = 56;
  const titleHeight = 150;

  const leftWidth =
    layout.leftCols * cellWidth + Math.max(0, layout.leftCols - 1) * gap;
  const rightWidth =
    layout.rightCols * cellWidth + Math.max(0, layout.rightCols - 1) * gap;
  const gridWidth =
    layout.middle && layout.rightCols > 0
      ? leftWidth + AISLE_GAP + rightWidth
      : leftWidth;
  const gridRows = Math.max(
    layout.leftRows,
    layout.middle ? layout.rightRows : 0,
  );
  const gridHeight = gridRows * cellHeight + Math.max(0, gridRows - 1) * gap;

  const canvas = document.createElement("canvas");
  canvas.width = margin * 2 + gridWidth;
  canvas.height = margin * 2 + titleHeight + gridHeight + 90;

  const context = canvas.getContext("2d");
  context.fillStyle = "#edeaec";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#231f20";
  context.font = '700 38px "Avenir Next", "Gill Sans", sans-serif';
  context.fillText("Plan de classe", margin, 68);

  context.fillStyle = "#4b4f54";
  context.font = '400 22px "Avenir Next", "Segoe UI", sans-serif';
  context.fillText(courseSubtitle(), margin, 102);

  context.fillStyle = "#6f5521";
  context.font = '700 24px "Avenir Next", "Gill Sans", sans-serif';
  drawCenteredCanvasText(context, "AVANT", canvas.width / 2, 136);

  const top = margin + titleHeight;
  plan.seats.forEach((seat) => {
    const x =
      seat.section === "left"
        ? margin + seat.col * (cellWidth + gap)
        : margin + leftWidth + AISLE_GAP + seat.col * (cellWidth + gap);
    const y = top + seat.row * (cellHeight + gap);

    const seatState = seatVisualState(seat);
    let fill = "#ffffff";
    let textFill = "#231f20";
    if (seatState === "selected") {
      fill = "#5b6770";
      textFill = "#ffffff";
    } else if (seatState === "blocked") {
      fill = "#8a391b";
      textFill = "#ffffff";
    } else if (seatState === "block-mode") {
      fill = "#e7ebdf";
    }

    drawRoundedRect(context, x, y, cellWidth, cellHeight, 12, fill, "#4b4f54");
    context.fillStyle = textFill;
    context.font = '400 20px "Avenir Next", "Segoe UI", sans-serif';
    const lines = wrapCanvasText(context, seat.name, cellWidth - 20);
    const lineHeight = 24;
    const textHeight = lines.length * lineHeight;
    lines.forEach((line, index) => {
      const width = context.measureText(line).width;
      context.fillText(
        line,
        x + (cellWidth - width) / 2,
        y + (cellHeight - textHeight) / 2 + lineHeight * (index + 0.8),
      );
    });
  });

  context.fillStyle = "#6f5521";
  context.font = '700 24px "Avenir Next", "Gill Sans", sans-serif';
  drawCenteredCanvasText(
    context,
    "ARRIÈRE",
    canvas.width / 2,
    canvas.height - 28,
  );

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "plan_de_classe.png";
  link.click();
}

function drawCenteredCanvasText(context, text, centerX, y) {
  const width = context.measureText(text).width;
  context.fillText(text, centerX - width / 2, y);
}

function wrapCanvasText(context, text, maxWidth) {
  if (!text) {
    return [""];
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [""];
  }

  const lines = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (context.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(current);
  return lines;
}

function drawRoundedRect(context, x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - radius,
    y + height,
  );
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = stroke;
  context.stroke();
}

function setSelectOptions(
  select,
  items,
  placeholder,
  selectedValue,
  getLabel,
  getValue,
) {
  select.innerHTML = "";

  const placeholderOption = document.createElement("option");
  placeholderOption.value = "";
  placeholderOption.textContent = placeholder;
  select.appendChild(placeholderOption);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = getValue(item);
    option.textContent = getLabel(item);
    select.appendChild(option);
  });

  select.value = selectedValue || "";
}

function render() {
  sanitizeFilters();

  setSelectOptions(
    elements.teacherSelect,
    state.options.teachers,
    ALL_TEACHERS_PLACEHOLDER,
    state.teacher,
    (item) => item,
    (item) => item,
  );

  setSelectOptions(
    elements.proctorSelect,
    state.options.proctors,
    ALL_PROCTORS_PLACEHOLDER,
    state.proctor,
    (item) => item,
    (item) => item,
  );

  setSelectOptions(
    elements.courseSelect,
    state.options.courses,
    COURSE_PLACEHOLDER,
    state.course,
    (item) => item.title,
    (item) => item.code,
  );

  setSelectOptions(
    elements.roomSelect,
    state.options.rooms,
    LOCAL_PLACEHOLDER,
    state.layout.room === LOCAL_PLACEHOLDER ? "" : state.layout.room,
    (item) => item,
    (item) => item,
  );

  elements.leftRowsInput.value = state.layout.leftRows;
  elements.leftColsInput.value = state.layout.leftCols;
  elements.rightRowsInput.value = state.layout.rightRows;
  elements.rightColsInput.value = state.layout.rightCols;
  elements.middleCheckbox.checked = state.layout.middle;
  elements.rightRowsInput.disabled = !state.layout.middle;
  elements.rightColsInput.disabled = !state.layout.middle;

  const studentCount = getCurrentNames().length;
  elements.studentCount.textContent = `${studentCount} ${studentCount === 1 ? "étudiant" : "étudiants"}`;
  elements.seatCount.textContent = String(state.plan?.seatCount || 0);
  if (elements.overflowCount) {
    elements.overflowCount.textContent = String(state.plan?.overflowCount || 0);
  }
  elements.planSubtitle.textContent = courseSubtitle();

  elements.blockModeBtn.classList.toggle("is-active", state.blockMode);
  elements.blockModeBtn.textContent = state.blockMode
    ? "Quitter l’exclusion"
    : "Exclure des places";

  const controlsDisabled = !state.dataLoaded;
  [
    elements.teacherSelect,
    elements.proctorSelect,
    elements.courseSelect,
    elements.roomSelect,
    elements.namesInput,
    elements.leftRowsInput,
    elements.leftColsInput,
    elements.rightRowsInput,
    elements.rightColsInput,
    elements.middleCheckbox,
    elements.generateBtn,
    elements.blockModeBtn,
    elements.resetFiltersBtn,
    elements.fullscreenBtn,
    elements.exportBtn,
  ].forEach((element) => {
    element.disabled = controlsDisabled;
  });

  elements.planGrid.innerHTML = "";
  elements.planGrid.style.gridTemplateColumns = gridTemplateColumns();
  (state.plan?.seats || []).forEach((seat) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `seat seat--${seatVisualState(seat)}`;
    button.style.gridColumn = String(seat.displayCol + 1);
    button.style.gridRow = String(seat.row + 1);
    button.textContent = seat.name;
    button.addEventListener("click", () => clickSeat(seat.index));
    button.disabled = controlsDisabled;
    elements.planGrid.appendChild(button);
  });
}

function resetFilters() {
  state.teacher = null;
  state.proctor = null;
  state.course = null;
  state.namesText = "";
  state.blockMode = false;
  state.selectedSourceIndex = null;
  state.layout = normalizeLayout(DEFAULT_LAYOUT);
  state.plan = buildEmptyPlan();
  elements.namesInput.value = "";
  render();
}

function refreshNamesFromCourse() {
  state.namesText = state.course
    ? getStudents(state.course, state.teacher, state.proctor).join("\n")
    : "";
  elements.namesInput.value = state.namesText;
  state.blockMode = false;
  state.selectedSourceIndex = null;
  applyRoomFromSelectedCourse();
  render();
}

async function loadDataSources({ surveillanceText, examsText, teachersText, roomsData }) {
  const examSourceText = examsText || "";
  const teacherSourceText = teachersText || "";
  state.sourceData = {
    surveillanceText,
    examsText: examSourceText,
    teachersText: teacherSourceText,
    roomsData,
  };
  state.roomsConfig = loadRoomConfigurations(roomsData);
  state.model = buildModel(surveillanceText, examSourceText, teacherSourceText);
  state.dataLoaded = true;
  state.teacher = null;
  state.proctor = null;
  state.course = null;
  state.namesText = "";
  elements.namesInput.value = "";
  generatePlan({ preserveBlocked: false });
  render();
}

async function bootstrap() {
  state.dataLoaded = false;
  state.plan = buildEmptyPlan();
  render();
  elements.secretInput.focus();
}

async function unlockWithSecret(secret) {
  elements.unlockError.textContent = "";
  elements.unlockBtn.disabled = true;

  try {
    const decryptedData = await decryptEncryptedData(secret);
    await loadDataSources(decryptedData);
    elements.secretInput.value = "";
    document.body.classList.remove("is-locked");
    elements.unlockOverlay.hidden = true;
  } catch (error) {
    console.error(error);
    state.dataLoaded = false;
    state.plan = buildEmptyPlan();
    render();
    elements.unlockError.textContent = error.message.includes("absent")
      ? "Fichier de données introuvable"
      : "Code invalide";
  } finally {
    elements.unlockBtn.disabled = false;
  }
}

function handleRoomChange() {
  applyRoomConfiguration(elements.roomSelect.value || LOCAL_PLACEHOLDER);
  generatePlan({ preserveBlocked: false });
  render();
}

function handleLayoutChange() {
  updateLayoutFromControls();
  generatePlan({ preserveBlocked: false });
  render();
}

function localeSort(left, right) {
  return left.localeCompare(right, "fr");
}

function intersection(left, right) {
  return new Set([...left].filter((item) => right.has(item)));
}

function hasIntersection(left, right) {
  return [...left].some((item) => right.has(item));
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

elements.teacherSelect.addEventListener("change", () => {
  state.teacher = elements.teacherSelect.value || null;
  applyAutomaticSelections();
  refreshNamesFromCourse();
});

elements.proctorSelect.addEventListener("change", () => {
  state.proctor = elements.proctorSelect.value || null;
  applyAutomaticSelections();
  refreshNamesFromCourse();
});

elements.courseSelect.addEventListener("change", () => {
  state.course = elements.courseSelect.value || null;
  applyAutomaticSelections();
  refreshNamesFromCourse();
});

elements.unlockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  unlockWithSecret(elements.secretInput.value);
});

elements.resetFiltersBtn.addEventListener("click", resetFilters);
elements.generateBtn.addEventListener("click", () => {
  state.blockMode = false;
  state.selectedSourceIndex = null;
  generatePlan();
  render();
});

elements.blockModeBtn.addEventListener("click", () => {
  state.blockMode = !state.blockMode;
  if (state.blockMode) {
    state.selectedSourceIndex = null;
  }
  render();
});

elements.fullscreenBtn.addEventListener("click", () => {
  localStorage.setItem(
    "classroom-plan-view",
    JSON.stringify(serializeProjectionState()),
  );
  window.open("./view.html", "_blank", "noopener");
});

elements.exportBtn.addEventListener("click", exportPlanAsPng);
elements.roomSelect.addEventListener("change", handleRoomChange);
elements.middleCheckbox.addEventListener("change", handleLayoutChange);
[
  elements.leftRowsInput,
  elements.leftColsInput,
  elements.rightRowsInput,
  elements.rightColsInput,
].forEach((input) => input.addEventListener("change", handleLayoutChange));

state.plan = buildEmptyPlan();
render();
bootstrap();
