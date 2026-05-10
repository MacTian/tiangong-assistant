# React 开发笔记

## 组件生命周期

### 函数组件 Hooks

- **useState**：管理组件状态
- **useEffect**：处理副作用，依赖数组控制执行时机
- **useMemo**：缓存计算结果
- **useCallback**：缓存函数引用

## 性能优化

1. **React.memo**：避免不必要的重新渲染
2. **懒加载**：React.lazy + Suspense
3. **代码分割**：动态 import
4. **虚拟列表**：大量数据渲染优化

## 状态管理

- 简单状态：useState / useReducer
- 跨组件：Context API
- 复杂应用：Redux / Zustand

## 最佳实践

- 组件拆分保持单一职责
- 避免内联对象和函数（除非配合 useMemo/useCallback）
- 使用 TypeScript 增强类型安全
- ESLint + Prettier 代码规范

## 常见问题

**Q：为什么 useEffect 会执行两次？**  
A：React 18 严格模式下开发环境会模拟卸载重挂载。

**Q：如何避免无限循环？**  
A：确保依赖数组准确，避免在 effect 中直接修改依赖的状态。
