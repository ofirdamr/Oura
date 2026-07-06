# Escalation & Handoff — read this file only when one of these actually happens

This detail is split out of `SKILL.md` on purpose: these are recovery paths for
specific bad-day scenarios, not something every task needs loaded up front.
Read this file the moment one of the four situations below actually occurs —
don't pre-load it "just in case."

---

## 1. Resuming after a usage-limit interruption

If a subagent spawn fails or gets cut off because of an account/session usage
limit, that is not a signal to silently downgrade the orchestration mode. Once
the limit clears, resume the SAME mode the Economist originally picked for
that mission — if it was Hybrid/Parallel, go back to independent subagents for
the remaining/retry work, don't quietly absorb it into solo Classic work just
because the first attempt got interrupted. If the limit is still blocking and
there's real pressure to keep moving, say so explicitly and ask before falling
back to solo — don't decide unilaterally that "solo for now" is fine and never
revisit it. The interruption is a temporary infrastructure fact, not a
re-consult.

## 2. PM escalation when a subagent fails or gets stuck

Default execution stays on the leanest model that can do the work — most
subagent work runs on Haiku/Sonnet, not the top tier, because that's the
economical default. But the PM (the senior architect/engineer role, ultimately
the orchestrating session itself) is responsible for watching subagents, not
just firing them off and waiting silently. If a subagent fails, comes back
confused, produces something wrong, or the problem turns out to be harder or
more tangled than the task looked when it was handed out, that is the PM's cue
to step in personally, on the highest available model (Opus, or Fable when
that's the top tier available) — the PM does not just retry the same
cheap-model subagent again and hope, and does not silently downgrade the fix
to a quick patch on the same tier that just failed. Escalating to the top
model is an exception path for when things get complicated, not the default
posture — most of the work still belongs on the economical subagent tier.
After the PM resolves the hard part, routine/mechanical follow-on work can
drop back down to a cheaper model rather than staying pinned to the top tier.
This also means the PM must actually check subagent output quality (read the
diff, rerun verification) rather than trusting a "done" self-report at face
value — the watching obligation is what triggers the escalation in the first
place.

## 3. Stop-and-re-consult when the orchestrating session itself is struggling

The escalation trigger above isn't only for subagents — it applies just as
much when the main session doing the work solo is the one repeating mistakes,
second-guessing its own fixes, or needing several corrected attempts at the
same class of bug. That is a signal to stop mid-task and go back to the Token
Economist/PM decision point, out loud, before continuing — not to grind
forward on the same approach hoping the next attempt lands. The re-consult
explicitly reconsiders all of: should the PM (this session) keep doing it
solo, should the work fan out to independent subagents (Parallel/Hybrid
instead of Classic — e.g. an audit-many-screens task is exactly this shape),
should a specific role take it with fresh eyes, or should the model change via
the Token Economist. State the re-consult and its outcome in one visible line,
then proceed under whatever it decides — don't silently keep pushing the same
failing approach because stopping feels like it wastes the effort already
spent.

## 4. Session handoff protocol

Recommending "start a fresh session" is not the end of the job — a handoff
done sloppily wastes exactly the tokens/time it was supposed to save, because
the next session either repeats work, stalls on a decision that evaporated
with the old chat, or sits on code that never went live. This happened for
real on this project: a session recommended a fresh start, the user had
*already* opened the next one, and only then did it surface that a PR was
still unmerged and an open question had never been written down anywhere the
new session could see. Do it right, every time, in this order:

1. **Recognize the trigger yourself, before being asked.** Signals: this
   conversation has already been through a context compaction, it has covered
   3+ unrelated workstreams, or a natural milestone/PR boundary was just
   reached. Say so out loud the moment you notice — don't wait for the user to
   notice the conversation has become unwieldy.
2. **Merge before you recommend, don't leave it as a future question.** If an
   open PR's code is already deployed/live, "should this be merged" is not a
   decision to defer to later — merging it IS part of closing out the session
   cleanly. Do it now, then tell the user it's done, rather than asking them
   to remember to ask you.
3. **Every open question gets resolved or written down — never just dropped.**
   Before recommending a handoff, check: is there any question asked this
   session that never got a final answer? Either get the answer now, or if the
   user genuinely isn't ready to decide, write the open question into
   `SUMMARY.md` explicitly (what's being asked, why, what the options were) so
   it survives the handoff as a real artifact, not as something only visible
   in this chat's history.
4. **Hand over a self-contained first message** that references only
   committed state (file paths, branch name, PR number) — never "as we
   discussed" or anything that assumes the next session can see this one's
   history.
5. **State plainly that this protocol just ran** ("recognizing this is a good
   handoff point, checked: PR merged, docs current, no dangling questions —
   here's the first message for the next session") so the user sees the check
   happened, not just its output.
