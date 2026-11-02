import assert from "node:assert/strict";
import { test } from "node:test";
import { QUEUE_LINKS } from "../src/data/queue-report.ts";
import { communityHash, communityView } from "../src/pages/community/params.ts";

const view = (hash: string) => communityView(new URLSearchParams(hash.split("?")[1] ?? ""));

test("each Needs-you link opens its tab already filtered to what waits", () => {
  assert.deepEqual(view(QUEUE_LINKS.feedback), {
    tab: "feedback",
    feedback: { status: "open", category: "requests", page: 1 },
    submissions: { status: "pending", page: 1 },
    reviews: { reports: "open", page: 1, reviewsPage: 1 },
    visits: { outcome: "all", visibility: "visible", since: null, page: 1 },
  });
  const visits = view(QUEUE_LINKS.couldNotCharge);
  assert.equal(visits.tab, "visits");
  assert.deepEqual(visits.visits, { outcome: "could_not_charge", visibility: "visible", since: 7, page: 1 });
  const submissions = view(QUEUE_LINKS.submissions);
  assert.equal(submissions.tab, "submissions");
  assert.deepEqual(submissions.submissions, { status: "pending", page: 1 });
  const reviews = view(QUEUE_LINKS.reports);
  assert.equal(reviews.tab, "reviews");
  assert.deepEqual(reviews.reviews, { reports: "open", page: 1, reviewsPage: 1 });
});

test("no tab, or one this page doesn't have, is Feedback", () => {
  assert.equal(view("#/community").tab, "feedback");
  assert.equal(view("#/community?tab=bogus").tab, "feedback");
});

test("unknown or out-of-range values fall back to the defaults", () => {
  const v = view("#/community?tab=visits&outcome=maybe&visibility=x&since=8&page=-2&status=nope&category=praise&reports=x&rpage=0");
  assert.deepEqual(v.visits, { outcome: "all", visibility: "visible", since: null, page: 1 });
  assert.deepEqual(v.feedback, { status: "open", category: "requests", page: 1 });
  assert.deepEqual(v.reviews, { reports: "open", page: 1, reviewsPage: 1 });
  assert.equal(v.submissions.status, "pending", "a feedback status is not a submission status");
});

test("each tab reads its own values", () => {
  assert.deepEqual(view("#/community?tab=feedback&status=resolved&category=design&page=3").feedback, { status: "resolved", category: "design", page: 3 });
  assert.deepEqual(view("#/community?tab=feedback&category=all").feedback.category, "all");
  assert.deepEqual(view("#/community?tab=submissions&status=approved&page=2").submissions, { status: "approved", page: 2 });
  assert.deepEqual(view("#/community?tab=reviews&reports=all&rpage=4").reviews, { reports: "all", page: 1, reviewsPage: 4 });
  assert.deepEqual(view("#/community?tab=visits&visibility=hidden&since=30").visits, { outcome: "all", visibility: "hidden", since: 30, page: 1 });
});

test("communityHash drops defaults so a tab link stays short", () => {
  assert.equal(communityHash("submissions"), "#/community?tab=submissions");
  assert.equal(communityHash("feedback"), "#/community?tab=feedback");
});
