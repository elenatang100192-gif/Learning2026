
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import { Toaster } from "./app/components/ui/sonner";

  // 隐藏启动画面（Capacitor）
  const hideSplashScreen = async () => {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide();
    } catch (error) {
      // 如果不在 Capacitor 环境中，忽略错误
      console.log('SplashScreen not available:', error);
    }
  };

  // 应用加载完成后隐藏启动画面
  window.addEventListener('load', () => {
    setTimeout(hideSplashScreen, 100);
  });

  // DOM 加载完成后也尝试隐藏
  if (document.readyState === 'complete') {
    setTimeout(hideSplashScreen, 100);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(hideSplashScreen, 100);
    });
  }

  createRoot(document.getElementById("root")!).render(
    <>
      <App />
      <Toaster />
    </>
  );

  // 应用渲染完成后再次尝试隐藏启动画面
  setTimeout(hideSplashScreen, 500);
  