import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from "vue-router";
import LandingPage from "@/pages/LandingPage.vue";
import About from "@/pages/About.vue";
import Hemliga from "@/pages/Hemliga.vue";
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
      path: "/about",
      name: "about",
      component: About,
    },
    {
      path: "/hemliga",
      name: "hemliga",
      component: Hemliga,
    },
    {
      path: "/admin/feedback",
      name: "feedback-admin",
      component: FeedbackAdmin,
    },
    ...gameRouter,
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: () => import("@/pages/404.vue"),
    },
  ],
});

export default router;
