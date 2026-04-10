import { Navigate, useParams, type RouteObject } from "react-router-dom";

import MainLayout from "src/layouts/MainLayout";
import AdminLayout from "src/layouts/AdminLayout";
import SettingsLayout from "src/layouts/SettingsLayout";
import Home from "src/views/home";
import ProfileLayout from "src/views/profile";
import ProfileContents from "src/views/profile/contents";
import ProfileFollowing from "src/views/profile/following";
import ProfileFollowers from "src/views/profile/followers";
import ProfileFavorites from "src/views/profile/favorites";
import VideoDetail from "src/views/video";
import VideoEditor from "src/views/video/editor";
import GalleryDetail from "src/views/gallery";
import GalleryEditor from "src/views/gallery/editor";
import ArticleDetail from "src/views/article";
import ArticleEditor from "src/views/article/editor";
import PodcastDetail from "src/views/podcast";
import PodcastEditor from "src/views/podcast/editor";
import FollowingFeed from "src/views/following";
import AccountSettings from "src/views/settings/account";
import MyContents from "src/views/settings/contents";
import Favorites from "src/views/settings/favorites";
import MyComments from "src/views/settings/comments";
import SecuritySettings from "src/views/settings/security";
import NotificationSettings from "src/views/settings/notifications";
import AdminVideoContents from "src/views/admin/contents/videos";
import AdminGalleryContents from "src/views/admin/contents/galleries";
import AdminArticleContents from "src/views/admin/contents/articles";
import AdminPodcastContents from "src/views/admin/contents/podcasts";
import AdminUsers from "src/views/admin/users";
import SettingsAuth from "src/views/admin/settings/auth";
import SettingsStorage from "src/views/admin/settings/storage";
import SettingsWechat from "src/views/admin/settings/wechat";
import SettingsSite from "src/views/admin/settings/site";
import DatabaseBackups from "src/views/admin/backups/database";
import AdminCategories from "src/views/admin/categories";
import AdminNodes from "src/views/admin/nodes";
import Init from "src/views/init";
import Login from "src/views/login";
import Register from "src/views/register";
import NotFound from "src/views/errors/NotFound";
import Forbidden from "src/views/errors/Forbidden";
import ServerError from "src/views/errors/ServerError";

// DynamicSlug renders ProfileLayout (with child routes) when the slug starts with '@', otherwise Home.
// eslint-disable-next-line react-refresh/only-export-components
function DynamicSlug() {
  const { slug } = useParams<{ slug: string }>();
  if (slug?.startsWith("@")) {
    return <ProfileLayout />;
  }
  return <Home />;
}

const routes: RouteObject[] = [
  // Auth routes (no layout)
  { path: "/init", element: <Init /> },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  // Frontend routes
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "videos", element: <Home /> },
      { path: "galleries", element: <Home /> },
      { path: "articles", element: <Home /> },
      { path: "podcasts", element: <Home /> },
      { path: "following", element: <FollowingFeed /> },
      {
        path: ":slug",
        element: <DynamicSlug />,
        children: [
          { index: true, element: <ProfileContents /> },
          { path: "videos", element: <ProfileContents /> },
          { path: "galleries", element: <ProfileContents /> },
          { path: "articles", element: <ProfileContents /> },
          { path: "podcasts", element: <ProfileContents /> },
          { path: "speakers", element: <ProfileContents /> },
          { path: "following", element: <ProfileFollowing /> },
          { path: "followers", element: <ProfileFollowers /> },
          { path: "favorites", element: <ProfileFavorites /> },
        ],
      },
      // Video routes
      { path: "video/new", element: <VideoEditor /> },
      { path: "video/:id/edit", element: <VideoEditor /> },
      { path: "video/:id", element: <VideoDetail /> },
      // Gallery routes
      { path: "gallery/new", element: <GalleryEditor /> },
      { path: "gallery/:id/edit", element: <GalleryEditor /> },
      { path: "gallery/:id", element: <GalleryDetail /> },
      // Article routes
      { path: "article/new", element: <ArticleEditor /> },
      { path: "article/:id/edit", element: <ArticleEditor /> },
      { path: "article/:id", element: <ArticleDetail /> },
      // Podcast routes
      { path: "podcast/new", element: <PodcastEditor /> },
      { path: "podcast/:id/edit", element: <PodcastEditor /> },
      { path: "podcast/:id", element: <PodcastDetail /> },
      {
        path: "settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="/settings/account" replace /> },
          { path: "account", element: <AccountSettings /> },
          { path: "contents", element: <MyContents /> },
          { path: "favorites", element: <Favorites /> },
          { path: "comments", element: <MyComments /> },
          { path: "security", element: <SecuritySettings /> },
          { path: "notifications", element: <NotificationSettings /> },
        ],
      },
    ],
  },
  // Admin routes
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/admin/contents/videos" replace />,
      },
      {
        path: "contents",
        element: <Navigate to="/admin/contents/videos" replace />,
      },
      { path: "contents/videos", element: <AdminVideoContents /> },
      { path: "contents/galleries", element: <AdminGalleryContents /> },
      { path: "contents/articles", element: <AdminArticleContents /> },
      { path: "contents/podcasts", element: <AdminPodcastContents /> },
      { path: "users", element: <AdminUsers /> },
      { path: "nodes", element: <AdminNodes /> },
      { path: "categories", element: <AdminCategories /> },
      {
        path: "sync",
        element: <Navigate to="/admin/settings/wechat" replace />,
      },
      {
        path: "settings",
        element: <Navigate to="/admin/settings/site" replace />,
      },
      { path: "settings/site", element: <SettingsSite /> },
      { path: "settings/auth", element: <SettingsAuth /> },
      { path: "settings/storage", element: <SettingsStorage /> },
      { path: "settings/database-backup", element: <DatabaseBackups /> },
      { path: "settings/wechat", element: <SettingsWechat /> },
    ],
  },
  // Error pages
  { path: "/forbidden", element: <Forbidden /> },
  { path: "/500", element: <ServerError /> },
  { path: "*", element: <NotFound /> },
];

export default routes;
