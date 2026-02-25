// 使用原生网络请求绕过 CORS 的替代实现
// 注意：这需要创建自定义 Capacitor 插件

// 临时解决方案：尝试使用 no-cors 模式（但无法读取响应）
// 或者等待服务器添加 CORS 支持

import { Capacitor } from '@capacitor/core';

// 检测是否在 Capacitor 环境中
const isCapacitor = Capacitor.isNativePlatform();

// 原生网络请求函数（需要自定义插件支持）
const nativeRequest = async (url: string, options: RequestInit = {}) => {
  // 这里需要调用自定义的 Capacitor 插件
  // 插件使用原生代码（Swift/Objective-C）发送网络请求
  // 这样可以绕过 WebView 的 CORS 限制
  
  // 示例代码（需要实现对应的插件）：
  // const { NativeHttp } = await import('@capacitor/native-http');
  // return await NativeHttp.request({ url, method, headers, body });
  
  throw new Error('Native HTTP plugin not implemented. Please configure CORS on server or implement native HTTP plugin.');
};

// 回退到标准 fetch（如果不在原生环境）
const fallbackRequest = async (url: string, options: RequestInit = {}) => {
  return fetch(url, options);
};

// 统一的 API 请求函数
export const apiRequestNative = async (endpoint: string, options: RequestInit = {}) => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://nexusmind-api-test.ashgso.com/api/';
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${normalizedBaseUrl}${normalizedEndpoint}`;
  
  if (isCapacitor) {
    // 在原生环境中，尝试使用原生网络请求
    try {
      return await nativeRequest(url, options);
    } catch (error) {
      console.warn('Native request failed, falling back to fetch:', error);
      // 回退到标准 fetch
      return await fallbackRequest(url, options);
    }
  } else {
    // 在 Web 环境中，使用标准 fetch
    return await fallbackRequest(url, options);
  }
};

