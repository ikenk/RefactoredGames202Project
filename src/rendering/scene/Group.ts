import { SceneNode } from '@/rendering/scene/SceneNode'

/**
 * 为一组 SceneNode 提供语义化容器。
 *
 * @remarks
 * [DESIGN-WEIGHT:2][group-semantic-container]
 *
 * Group 只表示“这些节点在场景结构中属于同一个逻辑分组”。父子关系、Transform、
 * traversal 和 world matrix 等行为全部继承自 SceneNode。
 *
 * Group 不隐式拥有 Geometry、Material 或其他 Resource，也不负责释放 GPU 对象。
 * 资源的显式所有权由 Scene.own() 管理。
 *
 * 除稳定诊断类型以外，本类不引入新的场景图行为。
 */
export class Group extends SceneNode {
  /**
   * 为 debugLabel 提供不受生产构建类名压缩影响的稳定类型。
   *
   * @remarks
   * [DESIGN-WEIGHT:2][scene-node-stable-debug-type]
   *
   * 如果不覆写该 getter，未命名的 Group 会继承 `'SceneNode'`，最终显示为
   * `SceneNode#xxxxxxxx`。显式返回 `'Group'` 后，即使打包器重命名 JavaScript
   * constructor，诊断输出仍然保持稳定。
   */
  protected override get debugType(): string {
    return 'Group'
  }
}
