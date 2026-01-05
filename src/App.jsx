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
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
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

function WorkoutCard({ workout, onOpen }) {
  return (
    <button className="recipeCard" onClick={onOpen} type="button">
      <div className="recipeCard__top">
        <div className="recipeCard__title">{workout.title}</div>
        {workout.tags?.length ? (
          <div className="recipeCard__tags">
            {workout.tags.slice(0, 3).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="recipeCard__desc">{workout.description}</div>
      <div className="recipeCard__meta">
        <span className="subtle">
          {workout.exercises?.length || 0} exercises · {workout.steps?.length || 0} steps
        </span>
        <span className="recipeCard__cta">View</span>
      </div>
    </button>
  );
}

async function fetchPublicWorkouts() {
  const q = query(collection(db, "publicWorkouts"), orderBy("title"), limit(24));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function fetchPublicWorkoutById(workoutId) {
  const ref = doc(db, "publicWorkouts", workoutId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

async function addWorkoutLog({ uid, title, performedAtISO, durationMinutes, notes, templateId }) {
  const performedAt = performedAtISO ? new Date(performedAtISO) : new Date();
  const ref = collection(db, "users", uid, "workoutLogs");
  await addDoc(ref, {
    title: title?.trim() || "Workout",
    performedAt,
    durationMinutes: durationMinutes ? Number(durationMinutes) : null,
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
            Browse Templates
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
        setError(
          "Couldn’t load public workout templates. Make sure Firestore is enabled and you’ve added some docs to the publicWorkouts collection.",
        );
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
      title="Workout Templates"
      subtitle="Public templates anyone can view. Log in to track your workouts privately."
      right={right}
    >
      <div className="hero">
        <div className="hero__content">
          <div className="hero__title">How it works</div>
          <div className="hero__text subtle">
            Pick a template → log your session → it shows up in <b>My Workout Log</b> (private).
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

      <InlineError message={error} />
      {loading ? (
        <LoadingCard title="Loading public templates" />
      ) : workouts.length ? (
        <div className="grid">
          {workouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} onOpen={() => navigate(`#/workout?id=${encodeURIComponent(w.id)}`)} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <div className="panel__header">
            <div className="dot dot--amber" />
            <div className="panel__title">No public templates yet</div>
          </div>
          <div className="panel__body">
            Add a few documents to Firestore collection <code>publicWorkouts</code> to get started.
            {user ? (
              <div className="panel__actions">
                <button className="btn btn--primary" type="button" onClick={() => navigate("#/log")}>
                  Log a workout anyway
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

  return (
    <PageShell
      title={workout.title}
      subtitle={workout.description || "A public template anyone can view."}
      right={<div className="ctaRow">{action}</div>}
    >
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
  const [performedAtISO, setPerformedAtISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState("");
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
        setError("Couldn’t load your workout log. Check Firestore rules.");
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
                  durationMinutes,
                  notes,
                  templateId: initialTemplateId || null,
                });
                setTitle("");
                setDurationMinutes("");
                setNotes("");
                const items = await fetchWorkoutLogs(user.uid);
                setLogs(items);
              } catch {
                setError("Couldn’t save your workout log entry. Check Firestore rules.");
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
            </div>
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
                  {l.durationMinutes ? ` · ${l.durationMinutes} min` : ""}
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

            // Optional: store profile document (handy later; also shows Firestore usage)
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

function SeedHelper() {
  const [open, setOpen] = useState(false);
  const sample = useMemo(
    () => [
      {
        title: "Upper Body Strength",
        description: "Classic push/pull accessories with simple progression.",
        tags: ["strength", "upper"],
        exercises: ["Bench Press", "Lat Pulldown", "Dumbbell Row", "Overhead Press"],
        steps: ["Warm up 5–10 minutes.", "Work sets: 3–4 sets per exercise.", "Finish with light stretching."],
      },
      {
        title: "Lower Body + Core",
        description: "Squat-focused session with a short core finisher.",
        tags: ["strength", "lower"],
        exercises: ["Back Squat", "Romanian Deadlift", "Walking Lunges", "Plank"],
        steps: ["Warm up hips/ankles.", "Main lift first, then accessories.", "Core finisher: 3 rounds."],
      },
    ],
    [],
  );

  return (
    <div className="panel">
      <div className="panel__header">
        <div className="dot dot--amber" />
        <div className="panel__title">Need sample data?</div>
        <div className="panel__spacer" />
        <button className="btn btn--ghost btn--small" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? (
        <div className="panel__body">
          <p className="subtle">
            Create Firestore collection <code>publicWorkouts</code> and add documents with these fields:
            <code>title</code>, <code>description</code>, <code>exercises</code> (array), <code>steps</code> (array),
            optional <code>tags</code> (array).
          </p>
          <div className="codeLike">
            {JSON.stringify(sample, null, 2)}
          </div>
        </div>
      ) : null}
    </div>
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
  if (path === "/") content = <><BrowsePage /><SeedHelper /></>;
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
            Public templates: <code>publicWorkouts</code> · Private log: <code>users/&lt;uid&gt;/workoutLogs</code>
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
