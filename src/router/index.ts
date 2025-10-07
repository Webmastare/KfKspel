import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from "vue-router";
import LandingPage from "@/pages/LandingPage.vue";
import Feedback from "@/pages/Feedback.vue";
import FeedbackAdmin from "@/pages/FeedbackAdmin.vue";
import gameRouter from "./gamesRouter";

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: LandingPage,
    },
    {
      path: "/feedback",
      name: "feedback",
      component: Feedback,
    },
    {
      path: "/admin/feedback",
      name: "feedback-admin",
      component: FeedbackAdmin,
    },
    ...gameRouter,
  ],
});

export default router;
