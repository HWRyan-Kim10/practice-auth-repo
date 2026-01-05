import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { useAuth } from "./auth/AuthContext.jsx";
import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function navigate(nextHash) {
  window.location.hash = nextHash;
}

function parseRoute(hash) {
  const raw = (hash || "#/").replace(/^#/, "");
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart || "/";
  const queryParams = new URLSearchParams(queryPart || "");
  return { path, queryParams };
}

function LoadingCard({ title = "Loading…" }) {
  return (
    <div className="panel">
      <div className="panel__header">
        <div className="dot dot--amber" />
        <div className="panel__title">{title}</div>
      </div>
      <div className="panel__body subtle">Please wait a moment.</div>
    </div>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="alert alert--error" role="alert">
      {message}
    </div>
  );
}

function useUserProfile(uid) {
  const [loading, setLoading] = useState(Boolean(uid));
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!uid) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const ref = doc(db, "users", uid);
        const snap = await getDoc(ref);
        if (!alive) return;
        setProfile(snap.exists() ? snap.data() : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  return { loading, profile };
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function OnboardingModal({ open, onClose, onStartLog, onBrowse }) {
  if (!open) return null;
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" aria-label="Welcome to LiftLog">
      <div className="modal">
        <div className="modal__header">
          <div className="modal__title">Welcome to LiftLog</div>
          <div className="subtle">You’re in. Here’s what to do next.</div>
        </div>

        <div className="modal__body">
          <div className="steps">
            <div className="step">
              <div className="step__num">1</div>
              <div className="step__content">
                <div className="step__title">Browse templates</div>
                <div className="subtle">Templates are public. Pick one you like.</div>
              </div>
            </div>
            <div className="step">
              <div className="step__num">2</div>
              <div className="step__content">
                <div className="step__title">Log your workout</div>
                <div className="subtle">Your workout log is private—only you can see it.</div>
              </div>
            </div>
            <div className="step">
              <div className="step__num">3</div>
              <div className="step__content">
                <div className="step__title">Build history</div>
                <div className="subtle">See your sessions and notes over time.</div>
              </div>
            </div>
          </div>

          <div className="howItWorks">
            <Badge tone="neutral">Public</Badge> <span className="subtle">Templates</span>
            <span className="subtle">·</span>
            <Badge tone="success">Private</Badge> <span className="subtle">My Workout Log</span>
          </div>
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost" type="button" onClick={onBrowse}>
            Browse templates
          </button>
          <button className="btn btn--primary" type="button" onClick={onStartLog}>
            Log my first workout
          </button>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

function WorkoutCard({ workout, onOpen, onLike, onDislike, voting }) {
  const musclesText = workout.muscles?.length ? workout.muscles.join(", ") : "Full body / unspecified";
  const tracking =
    workout.trackingType === "reps"
      ? `Reps-based${workout.suggestedSets ? ` · ${workout.suggestedSets} sets` : ""}${
          workout.suggestedReps ? ` · ${workout.suggestedReps} reps` : ""
        }`
      : `Time-based${workout.suggestedDurationMinutes ? ` · ${workout.suggestedDurationMinutes} min` : ""}`;

  const likeCount = Number.isFinite(workout.likeCount) ? workout.likeCount : 0;
  const dislikeCount = Number.isFinite(workout.dislikeCount) ? workout.dislikeCount : 0;
  const exerciseCount = Array.isArray(workout.exercises) ? workout.exercises.length : 0;

  return (
    <div className="recipeCard" role="group" aria-label={`Workout: ${workout.title}`}>
      <div className="recipeCard__top">
        <button className="recipeCard__titleBtn" onClick={onOpen} type="button">
          <div className="recipeCard__title">{workout.title}</div>
        </button>
        {workout.tags?.length ? (
          <div className="recipeCard__tags">
            {workout.tags.slice(0, 3).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="recipeCard__desc">{workout.description}</div>
      <div className="catalogMeta">
        <div className="catalogMeta__row">
          <div className="catalogMeta__label">Targets</div>
          <div className="catalogMeta__value">{musclesText}</div>
        </div>
        <div className="catalogMeta__row">
          <div className="catalogMeta__label">Tracking</div>
          <div className="catalogMeta__value">{tracking}</div>
        </div>
        <div className="catalogMeta__row">
          <div className="catalogMeta__label">Exercises</div>
          <div className="catalogMeta__value">{exerciseCount ? `${exerciseCount} total` : "—"}</div>
        </div>
      </div>
      <div className="voteRow" aria-label="Votes">
        <button className="iconBtn" type="button" onClick={onLike} disabled={voting} aria-label="Like">
          <span className="iconBtn__icon">👍</span>
          <span className="iconBtn__count">{likeCount}</span>
        </button>
        <button className="iconBtn" type="button" onClick={onDislike} disabled={voting} aria-label="Dislike">
          <span className="iconBtn__icon">👎</span>
          <span className="iconBtn__count">{dislikeCount}</span>
        </button>
      </div>
    </div>
  );
}

function toLocalDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function localMiddayFromDateInput(yyyyMmDd) {
  if (!yyyyMmDd) return new Date();
  const [y, m, d] = yyyyMmDd.split("-").map((n) => Number(n));
  // Use midday local time to avoid timezone/DST shifting into previous/next day.
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

async function fetchPublicWorkouts() {
  const q = query(collection(db, "publicWorkouts"), orderBy("title"), limit(24));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function seedStarterCatalog() {
  const items = [
    {
      id: "push-day-strength",
      title: "Push Day (Strength)",
      description: "Chest/shoulders/triceps with lower reps and longer rest.",
      muscles: ["Chest", "Shoulders", "Triceps"],
      trackingType: "reps",
      suggestedSets: 4,
      suggestedReps: "4–6",
      tags: ["strength", "upper"],
      exercises: ["Bench Press", "Overhead Press", "Incline Dumbbell Press", "Triceps Pushdown"],
      steps: ["Warm up 5–10 min.", "Ramp-up sets for first lift.", "Main sets, then accessories.", "Cool down + stretch."],
    },
    {
      id: "pull-day-hypertrophy",
      title: "Pull Day (Hypertrophy)",
      description: "Back/biceps volume for size and control.",
      muscles: ["Back", "Biceps", "Rear delts"],
      trackingType: "reps",
      suggestedSets: 3,
      suggestedReps: "8–12",
      tags: ["hypertrophy", "upper"],
      exercises: ["Lat Pulldown", "Chest-Supported Row", "Face Pulls", "Bicep Curls"],
      steps: ["Warm up.", "Focus on full range of motion.", "Keep 1–2 reps in reserve on most sets."],
    },
    {
      id: "legs-day-strength",
      title: "Legs Day (Strength)",
      description: "Squat-focused day with posterior chain support work.",
      muscles: ["Quads", "Glutes", "Hamstrings"],
      trackingType: "reps",
      suggestedSets: 4,
      suggestedReps: "3–5",
      tags: ["strength", "lower"],
      exercises: ["Back Squat", "Romanian Deadlift", "Leg Press", "Calf Raises"],
      steps: ["Warm up hips/ankles.", "Main lift first.", "Accessories after.", "Light stretching."],
    },
    {
      id: "upper-body-beginner",
      title: "Upper Body (Beginner)",
      description: "Simple full upper routine that’s easy to progress weekly.",
      muscles: ["Chest", "Back", "Shoulders", "Arms"],
      trackingType: "reps",
      suggestedSets: 3,
      suggestedReps: "8–10",
      tags: ["beginner", "upper"],
      exercises: ["Push-ups (or Bench Press)", "Lat Pulldown", "Dumbbell Shoulder Press", "Dumbbell Row"],
      steps: ["Start light.", "Add reps until top of range, then add weight.", "Stop sets with good form."],
    },
    {
      id: "core-stability",
      title: "Core Stability",
      description: "Anti-extension/anti-rotation core work for better bracing.",
      muscles: ["Core"],
      trackingType: "reps",
      suggestedSets: 3,
      suggestedReps: "10–15",
      tags: ["core"],
      exercises: ["Dead Bug", "Pallof Press", "Side Plank", "Bird Dog"],
      steps: ["Slow and controlled.", "Breathe and brace.", "Rest 30–60 sec between movements."],
    },
    {
      id: "hiit-20",
      title: "HIIT (20 min)",
      description: "Short intervals to push conditioning fast.",
      muscles: ["Full body"],
      trackingType: "duration",
      suggestedDurationMinutes: 20,
      tags: ["cardio", "hiit"],
      exercises: ["Bike or Row", "Burpees (optional)"],
      steps: ["Warm up 3–5 min.", "Intervals: 30s hard / 90s easy (repeat).", "Cool down 3–5 min."],
    },
    {
      id: "steady-state-30",
      title: "Steady State Cardio (30 min)",
      description: "Easy-to-moderate pace for recovery and endurance base.",
      muscles: ["Full body"],
      trackingType: "duration",
      suggestedDurationMinutes: 30,
      tags: ["cardio", "endurance"],
      exercises: ["Walk", "Jog", "Bike", "Elliptical"],
      steps: ["Keep a conversational pace.", "Stay consistent.", "Finish with light stretching."],
    },
    {
      id: "glutes-hamstrings",
      title: "Glutes + Hamstrings",
      description: "Posterior chain focus for strength and shape.",
      muscles: ["Glutes", "Hamstrings"],
      trackingType: "reps",
      suggestedSets: 3,
      suggestedReps: "8–12",
      tags: ["lower", "hypertrophy"],
      exercises: ["Hip Thrust", "Romanian Deadlift", "Hamstring Curl", "Glute Bridge"],
      steps: ["Warm up glutes/hamstrings.", "Control the eccentric.", "Squeeze at the top."],
    },
    {
      id: "shoulders-arms",
      title: "Shoulders + Arms",
      description: "Accessory day for delts, biceps, and triceps.",
      muscles: ["Shoulders", "Biceps", "Triceps"],
      trackingType: "reps",
      suggestedSets: 3,
      suggestedReps: "10–15",
      tags: ["upper", "accessories"],
      exercises: ["Lateral Raises", "Rear Delt Fly", "Hammer Curls", "Overhead Triceps Extension"],
      steps: ["Keep tension.", "Avoid swinging.", "Short rests 45–75 sec."],
    },
    {
      id: "full-body-circuit",
      title: "Full Body Circuit",
      description: "Move fast through simple exercises for a sweat session.",
      muscles: ["Full body"],
      trackingType: "duration",
      suggestedDurationMinutes: 25,
      tags: ["circuit", "conditioning"],
      exercises: ["Air Squats", "Push-ups", "Rows (band)", "Plank"],
      steps: ["Set a timer.", "Rotate exercises for 3–5 rounds.", "Rest as needed."],
    },
    {
      id: "mobility-15",
      title: "Mobility (15 min)",
      description: "Quick mobility routine for hips, shoulders, and spine.",
      muscles: ["Mobility"],
      trackingType: "duration",
      suggestedDurationMinutes: 15,
      tags: ["mobility", "recovery"],
      exercises: ["Hip flexor stretch", "Thoracic rotations", "Shoulder dislocates (band)", "Ankle rocks"],
      steps: ["Breathe slowly.", "Hold 30–45 seconds.", "No pain—just gentle tension."],
    },
    {
      id: "upper-body-endurance",
      title: "Upper Body Endurance",
      description: "Lighter weight, higher reps for muscular endurance.",
      muscles: ["Chest", "Back", "Shoulders", "Arms"],
      trackingType: "reps",
      suggestedSets: 2,
      suggestedReps: "15–20",
      tags: ["endurance", "upper"],
      exercises: ["Incline Push-ups", "Seated Row", "Dumbbell Press", "Triceps Rope + Curl superset"],
      steps: ["Short rests 30–60 sec.", "Smooth reps.", "Stop 1 rep before form breaks."],
    },
  ];

  const batch = writeBatch(db);
  for (const w of items) {
    batch.set(doc(db, "publicWorkouts", w.id), {
      ...w,
      likeCount: 0,
      dislikeCount: 0,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

async function fetchPublicWorkoutById(workoutId) {
  const ref = doc(db, "publicWorkouts", workoutId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function addWorkoutLog({
  uid,
  title,
  performedAtISO,
  trackingType,
  durationMinutes,
  sets,
  reps,
  notes,
  templateId,
}) {
  const performedAt = localMiddayFromDateInput(performedAtISO);
  const ref = collection(db, "users", uid, "workoutLogs");
  await addDoc(ref, {
    title: title?.trim() || "Workout",
    performedAt,
    trackingType: trackingType || "duration",
    durationMinutes: trackingType === "duration" && durationMinutes ? Number(durationMinutes) : null,
    sets: trackingType === "reps" && sets ? Number(sets) : null,
    reps: trackingType === "reps" && reps ? String(reps) : null,
    notes: notes?.trim() || null,
    templateId: templateId || null,
    createdAt: serverTimestamp(),
  });
}

async function fetchWorkoutLogs(uid) {
  const q = query(collection(db, "users", uid, "workoutLogs"), orderBy("performedAt", "desc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function TopNav() {
  const { user, loading } = useAuth();
  const displayName = user?.displayName?.trim();

  return (
    <header className="nav">
      <div className="nav__inner">
        <button className="brand" type="button" onClick={() => navigate("#/")}>
          <span className="brand__mark">🏋️</span>
          <span className="brand__name">LiftLog</span>
        </button>

        <nav className="nav__links" aria-label="Primary">
          <button className="navLink" type="button" onClick={() => navigate("#/")}>
            Workout Catalog
          </button>
          {user ? (
            <button className="navLink" type="button" onClick={() => navigate("#/log")}>
              My Workout Log
            </button>
          ) : null}
        </nav>

        <div className="nav__right">
          {loading ? (
            <span className="subtle">Checking session…</span>
          ) : user ? (
            <>
              <div className="navUser">
                <span className="navUser__pill">
                  <span className="dot dot--green" />
                  {displayName || user.email}
                </span>
              </div>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={async () => {
                  await signOut(auth);
                  navigate("#/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <button className="btn btn--ghost" type="button" onClick={() => navigate("#/login")}>
                Log in
              </button>
              <button className="btn btn--primary" type="button" onClick={() => navigate("#/signup")}>
                Sign up
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function PageShell({ title, subtitle, children, right }) {
  return (
    <section className="page">
      <div className="page__header">
      <div>
          <h1 className="h1">{title}</h1>
          {subtitle ? <p className="subtle page__subtitle">{subtitle}</p> : null}
        </div>
        {right ? <div className="page__right">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function BrowsePage() {
  const { user } = useAuth();
  const displayName = user?.displayName?.trim();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [votingId, setVotingId] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const items = await fetchPublicWorkouts();
        if (!alive) return;
        setWorkouts(items);
      } catch (e) {
        if (!alive) return;
        setError("Templates aren’t available yet. Please try again later.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const right = (
    <div className="ctaRow">
      <Badge tone="neutral">Public</Badge>
      {user ? <Badge tone="success">Logged in</Badge> : <Badge tone="warning">Logged out</Badge>}
    </div>
  );

  return (
    <PageShell
      title="Workout Catalog"
      subtitle="Explore workouts and see what muscles they target. Log in to track your own sessions privately."
      right={right}
    >
      <div className="hero">
        <div className="hero__content">
          <div className="hero__title">How it works</div>
          <div className="hero__text subtle">
            Pick a workout → log your session → it shows up in <b>My Workout Log</b> (private).
            {user ? ` Welcome, ${displayName || user.email}.` : ""}
          </div>
        </div>
        <div className="hero__actions">
          {user ? (
            <button className="btn btn--primary" type="button" onClick={() => navigate("#/log")}>
              Log a workout
            </button>
          ) : (
            <button className="btn btn--primary" type="button" onClick={() => navigate("#/signup")}>
              Create account
            </button>
          )}
          <button className="btn btn--ghost" type="button" onClick={() => navigate(user ? "#/log" : "#/login")}>
            {user ? "View my log" : "Log in"}
          </button>
        </div>
      </div>

      <div className="sectionHeader">
        <div>
          <div className="sectionHeader__title">Workout catalog</div>
          <div className="subtle">Tap a workout to see details. Vote with 👍/👎 to help others.</div>
        </div>
      </div>

      <InlineError message={error} />
      {loading ? (
        <LoadingCard title="Loading workout library" />
      ) : workouts.length ? (
        <div className="grid">
          {workouts.map((w) => (
            <WorkoutCard
              key={w.id}
              workout={w}
              voting={votingId === w.id}
              onOpen={() => navigate(`#/workout?id=${encodeURIComponent(w.id)}`)}
              onLike={async () => {
                try {
                  setVotingId(w.id);
                  setError("");
                  setWorkouts((prev) =>
                    prev.map((x) => (x.id === w.id ? { ...x, likeCount: (x.likeCount || 0) + 1 } : x)),
                  );
                  await updateDoc(doc(db, "publicWorkouts", w.id), { likeCount: increment(1) });
                } catch {
                  setWorkouts((prev) =>
                    prev.map((x) => (x.id === w.id ? { ...x, likeCount: Math.max((x.likeCount || 1) - 1, 0) } : x)),
                  );
                  setError("Couldn’t record your vote. Please try again.");
                } finally {
                  setVotingId("");
                }
              }}
              onDislike={async () => {
                try {
                  setVotingId(w.id);
                  setError("");
                  setWorkouts((prev) =>
                    prev.map((x) => (x.id === w.id ? { ...x, dislikeCount: (x.dislikeCount || 0) + 1 } : x)),
                  );
                  await updateDoc(doc(db, "publicWorkouts", w.id), { dislikeCount: increment(1) });
                } catch {
                  setWorkouts((prev) =>
                    prev.map((x) =>
                      x.id === w.id ? { ...x, dislikeCount: Math.max((x.dislikeCount || 1) - 1, 0) } : x,
                    ),
                  );
                  setError("Couldn’t record your vote. Please try again.");
                } finally {
                  setVotingId("");
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="panel">
          <div className="panel__header">
            <div className="dot dot--amber" />
            <div className="panel__title">No workouts yet</div>
          </div>
          <div className="panel__body">
            There aren’t any workouts to browse right now.
            {user ? (
              <div className="panel__actions">
                <button className="btn btn--primary" type="button" onClick={() => navigate("#/log")}>
                  Log a workout anyway
                </button>
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={async () => {
                    try {
                      setError("");
                      setLoading(true);
                      await seedStarterCatalog();
                      const items = await fetchPublicWorkouts();
                      setWorkouts(items);
                    } catch {
                      setError("Couldn’t create the starter catalog. Please try again.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Create starter catalog
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </PageShell>
  );
}

function WorkoutDetailPage({ workoutId }) {
  const { user } = useAuth();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const w = await fetchPublicWorkoutById(workoutId);
        if (!alive) return;
        if (!w) {
          setError("Workout template not found.");
          setWorkout(null);
          return;
        }
        setWorkout(w);
      } catch (e) {
        if (!alive) return;
        setError("Couldn’t load this workout template.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [workoutId]);

  if (loading) return <LoadingCard title="Loading template" />;
  if (error)
    return (
      <PageShell title="Workout Template" subtitle="Public workout details">
        <InlineError message={error} />
        <button className="btn btn--ghost" type="button" onClick={() => navigate("#/")}>
          Back to templates
        </button>
      </PageShell>
    );

  const action = user ? (
    <button
      className="btn btn--primary"
      type="button"
      onClick={() => navigate(`#/log?title=${encodeURIComponent(workout.title)}&templateId=${encodeURIComponent(workout.id)}`)}
    >
      Log this workout
    </button>
  ) : (
    <button className="btn btn--primary" type="button" onClick={() => navigate("#/login")}>
      Log in to track workouts
    </button>
  );

  const musclesText = workout.muscles?.length ? workout.muscles.join(", ") : "Full body / unspecified";
  const tracking =
    workout.trackingType === "reps"
      ? `Reps-based${workout.suggestedSets ? ` · ${workout.suggestedSets} sets` : ""}${
          workout.suggestedReps ? ` · ${workout.suggestedReps} reps` : ""
        }`
      : `Time-based${workout.suggestedDurationMinutes ? ` · ${workout.suggestedDurationMinutes} min` : ""}`;

  return (
    <PageShell
      title={workout.title}
      subtitle={workout.description || "A public template anyone can view."}
      right={<div className="ctaRow">{action}</div>}
    >
      <div className="panel">
        <div className="panel__header">
          <div className="dot dot--green" />
          <div className="panel__title">At a glance</div>
        </div>
        <div className="panel__body">
          <div className="facts">
            <div className="fact">
              <div className="fact__label">Targets</div>
              <div className="fact__value">{musclesText}</div>
            </div>
            <div className="fact">
              <div className="fact__label">Tracking</div>
              <div className="fact__value">{tracking}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="twoCol">
        <div className="panel">
          <div className="panel__header">
            <div className="dot dot--green" />
            <div className="panel__title">Exercises</div>
          </div>
          <div className="panel__body">
            {workout.exercises?.length ? (
              <ul className="list">
                {workout.exercises.map((x, idx) => (
                  <li key={`${idx}-${x}`}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="subtle">No exercises listed.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div className="dot dot--amber" />
            <div className="panel__title">Steps</div>
          </div>
          <div className="panel__body">
            {workout.steps?.length ? (
              <ol className="list">
                {workout.steps.map((s, idx) => (
                  <li key={`${idx}-${s}`}>{s}</li>
                ))}
              </ol>
            ) : (
              <p className="subtle">No steps listed.</p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function LogPage({ initialTitle, initialTemplateId }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState(initialTitle || "");
  const [performedAtISO, setPerformedAtISO] = useState(() => toLocalDateInputValue(new Date()));
  const [trackingType, setTrackingType] = useState("duration"); // "duration" | "reps"
  const [durationMinutes, setDurationMinutes] = useState("");
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const items = await fetchWorkoutLogs(user.uid);
        if (!alive) return;
        setLogs(items);
      } catch (e) {
        if (!alive) return;
        setError("Couldn’t load your workout log. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (!user) {
    return (
      <PageShell title="My Workout Log" subtitle="This area is only available when you’re logged in.">
        <div className="panel">
          <div className="panel__header">
            <div className="dot dot--amber" />
            <div className="panel__title">Log in required</div>
          </div>
          <div className="panel__body">
            <button className="btn btn--primary" type="button" onClick={() => navigate("#/login")}>
              Go to login
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title="My Workout Log" subtitle="Private content: only you can see this log." right={<Badge tone="success">Private</Badge>}>
      <InlineError message={error} />
      <div className="panel">
        <div className="panel__header">
          <div className="dot dot--green" />
          <div className="panel__title">Log a workout</div>
        </div>
        <div className="panel__body">
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setSubmitting(true);
                setError("");
                await addWorkoutLog({
                  uid: user.uid,
                  title,
                  performedAtISO,
                  trackingType,
                  durationMinutes,
                  sets,
                  reps,
                  notes,
                  templateId: initialTemplateId || null,
                });
                setTitle("");
                setDurationMinutes("");
                setSets("");
                setReps("");
                setNotes("");
                const items = await fetchWorkoutLogs(user.uid);
                setLogs(items);
              } catch {
                setError("Couldn’t save your workout. Please try again.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <label className="field">
              <span className="field__label">Workout name</span>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Upper Body Strength"
                required
              />
            </label>
            <div className="twoCol">
              <label className="field">
                <span className="field__label">Date</span>
                <input
                  className="input"
                  type="date"
                  value={performedAtISO}
                  onChange={(e) => setPerformedAtISO(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="field__label">Tracking</span>
                <select className="input" value={trackingType} onChange={(e) => setTrackingType(e.target.value)}>
                  <option value="duration">Time-based</option>
                  <option value="reps">Reps/Sets-based</option>
                </select>
              </label>
            </div>

            {trackingType === "duration" ? (
              <label className="field">
                <span className="field__label">Duration (minutes)</span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="45"
                />
              </label>
            ) : (
              <div className="twoCol">
                <label className="field">
                  <span className="field__label">Sets</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    value={sets}
                    onChange={(e) => setSets(e.target.value)}
                    placeholder="4"
                  />
                </label>
                <label className="field">
                  <span className="field__label">Reps (or range)</span>
                  <input className="input" value={reps} onChange={(e) => setReps(e.target.value)} placeholder="8-12" />
                </label>
              </div>
            )}

            <label className="field">
              <span className="field__label">Notes (optional)</span>
              <input
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="PR on bench, felt strong…"
              />
            </label>

            <button className="btn btn--primary btn--full" type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save log entry"}
            </button>
          </form>
        </div>
      </div>

      {loading ? (
        <LoadingCard title="Loading workout log" />
      ) : logs.length ? (
        <div className="grid">
          {logs.map((l) => (
            <div key={l.id} className="panel">
              <div className="panel__header">
                <div className="dot dot--amber" />
                <div className="panel__title">{l.title || "Workout"}</div>
                <div className="panel__spacer" />
                <span className="subtle">
                  {l.performedAt?.toDate ? l.performedAt.toDate().toLocaleDateString() : "—"}
                  {" · "}
                  {l.trackingType === "reps"
                    ? `${l.sets || "—"} sets · ${l.reps || "—"} reps`
                    : l.durationMinutes
                      ? `${l.durationMinutes} min`
                      : "—"}
                </span>
              </div>
              <div className="panel__body">{l.notes ? <span>{l.notes}</span> : <span className="subtle">No notes.</span>}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <div className="panel__header">
            <div className="dot dot--amber" />
            <div className="panel__title">No workouts logged yet</div>
          </div>
          <div className="panel__body">
            Add your first workout above to start your private log.
            <div className="panel__actions">
              <button className="btn btn--ghost" type="button" onClick={() => navigate("#/")}>
                Browse templates
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authCard__header">
          <div className="authCard__title">{title}</div>
          {subtitle ? <div className="subtle">{subtitle}</div> : null}
        </div>
        <div className="authCard__body">{children}</div>
        {footer ? <div className="authCard__footer">{footer}</div> : null}
      </div>
    </div>
  );
}

function LoginPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate("#/");
  }, [user]);

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to track workouts and access your private log."
      footer={
        <span className="subtle">
          No account?{" "}
          <button className="linkBtn" type="button" onClick={() => navigate("#/signup")}>
            Create one
          </button>
        </span>
      }
    >
      <InlineError message={error} />
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError("");
            await signInWithEmailAndPassword(auth, email.trim(), password);
            navigate("#/");
          } catch (err) {
            setError("Login failed. Double-check your email and password.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
          />
        </label>

        <button className="btn btn--primary btn--full" type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthCard>
  );
}

function SignupPage() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) navigate("#/");
  }, [user]);

  return (
    <AuthCard
      title="Create your account"
      subtitle="Sign up to track workouts in your private log."
      footer={
        <span className="subtle">
          Already have an account?{" "}
          <button className="linkBtn" type="button" onClick={() => navigate("#/login")}>
            Log in
          </button>
        </span>
      }
    >
      <InlineError message={error} />
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError("");
            const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const name = username.trim();
            if (name) {
              await updateProfile(cred.user, { displayName: name });
            }

            // Optional: store a profile document (helpful later)
            await setDoc(
              doc(db, "users", cred.user.uid),
              {
                username: name || null,
                email: cred.user.email,
                createdAt: serverTimestamp(),
              },
              { merge: true },
            );

            navigate("#/");
          } catch (err) {
            setError("Signup failed. Try a different email or a stronger password.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        <label className="field">
          <span className="field__label">Username (optional)</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. ryan"
            autoComplete="nickname"
          />
        </label>
        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>

        <button className="btn btn--primary btn--full" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </button>
      </form>
    </AuthCard>
  );
}

function App() {
  const hash = useHashRoute();
  const { user, loading } = useAuth();
  const { path, queryParams } = useMemo(() => parseRoute(hash), [hash]);
  const { loading: loadingProfile, profile } = useUserProfile(user?.uid);
  const [dismissedOnboarding, setDismissedOnboarding] = useState(false);

  const shouldShowOnboarding =
    Boolean(user) &&
    !loading &&
    !loadingProfile &&
    !dismissedOnboarding &&
    !(profile && profile.hasOnboarded === true);

  useEffect(() => {
    if (path === "/log" && !loading && !user) {
      navigate("#/login");
    }
  }, [path, loading, user]);

  let content = null;
  if (path === "/") content = <BrowsePage />;
  else if (path === "/login") content = <LoginPage />;
  else if (path === "/signup") content = <SignupPage />;
  else if (path === "/log") {
    const initialTitle = queryParams.get("title") || "";
    const templateId = queryParams.get("templateId") || "";
    content = <LogPage initialTitle={initialTitle} initialTemplateId={templateId} />;
  } else if (path === "/workout") {
    const workoutId = queryParams.get("id");
    content = workoutId ? <WorkoutDetailPage workoutId={workoutId} /> : <BrowsePage />;
  } else content = <BrowsePage />;

  return (
    <div className="app">
      <TopNav />
      <main className="main">
        <div className="container">{content}</div>
        <footer className="footer">
          <span className="subtle">
            Templates are public · Your workout log is private
          </span>
        </footer>
      </main>

      <OnboardingModal
        open={shouldShowOnboarding}
        onBrowse={async () => {
          setDismissedOnboarding(true);
          if (user) {
            await setDoc(doc(db, "users", user.uid), { hasOnboarded: true }, { merge: true });
          }
          navigate("#/");
        }}
        onStartLog={async () => {
          setDismissedOnboarding(true);
          if (user) {
            await setDoc(doc(db, "users", user.uid), { hasOnboarded: true }, { merge: true });
          }
          navigate("#/log");
        }}
        onClose={async () => {
          setDismissedOnboarding(true);
          if (user) {
            await setDoc(doc(db, "users", user.uid), { hasOnboarded: true }, { merge: true });
          }
        }}
      />
    </div>
  );
}

export default App;
