import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 不用 React.StrictMode:dev 下二次挂载 effect 会与后端事件订阅重复注册(HtyBox / HtyWiki 同款先例)
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
