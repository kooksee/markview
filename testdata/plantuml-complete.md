# PlantUML Complete Showcase

这个文档用于完整检查 PlantUML 在 `markview` 里的渲染效果。  
建议重点观察：中文文本、主题切换、全屏/缩放/平移、复杂连线可读性。

---

## 1) Sequence Diagram（时序图）

```plantuml
@startuml
skinparam shadowing false
skinparam sequence {
  ArrowColor #0969da
  LifeLineBorderColor #57606a
  LifeLineBackgroundColor #f6f8fa
  ParticipantBorderColor #57606a
  ParticipantBackgroundColor #ffffff
  ParticipantFontColor #1f2328
  ActorBorderColor #57606a
  ActorBackgroundColor #ffffff
  ActorFontColor #1f2328
}

autonumber
actor 用户 as User
participant "markview CLI" as CLI
participant "markview Server" as Server
participant "Kroki" as Kroki
participant "Browser" as Browser

User -> CLI: 执行 markview testdata/plantuml-complete.md
CLI -> Server: 启动/复用实例
CLI -> Server: 添加文件
Server -> Browser: 推送页面
Browser -> Server: 请求 Markdown 内容
Browser -> Kroki: POST PlantUML 源码
Kroki --> Browser: 返回 SVG
Browser --> User: 渲染图表

note over Browser
支持全屏、缩放、平移
用于检查交互体验
end note
@enduml
```

---

## 2) Class Diagram（类图）

```plantuml
@startuml
skinparam classAttributeIconSize 0
skinparam shadowing false

package "frontend" {
  class MarkdownViewer {
    +render(markdown): JSX
    +toggleRawView(): void
  }

  class MermaidBlock {
    +render(code): SVG
    +enterFullscreen(): void
  }

  class PlantUmlBlock {
    +render(code): SVG
    +zoom(delta): void
    +pan(dx, dy): void
    +copyCode(): void
  }

  class SvgBobBlock {
    +render(code): SVG
  }
}

class CodeBlockCopyButton {
  +copy(text): Promise<void>
}

MarkdownViewer --> MermaidBlock : uses
MarkdownViewer --> PlantUmlBlock : uses
MarkdownViewer --> SvgBobBlock : uses
PlantUmlBlock --> CodeBlockCopyButton : uses
@enduml
```

---

## 3) Activity Diagram（活动图）

```plantuml
@startuml
start
:读取 fenced code block;
if (language == plantuml/puml?) then (yes)
  :调用 Kroki 渲染;
  if (HTTP 200?) then (yes)
    :创建 Blob URL;
    :渲染 <img>;
  else (no)
    :回退为原始代码块;
  endif
else (no)
  :走普通高亮渲染;
endif
stop
@enduml
```

---

## 4) State Diagram（状态图）

```plantuml
@startuml
[*] --> Pending
Pending --> Rendered : 渲染成功
Pending --> Failed : 渲染失败
Rendered --> Fullscreen : 点击 Fullscreen
Fullscreen --> Rendered : 退出全屏
Fullscreen --> Fullscreen : 缩放/平移
Failed --> Pending : 重新渲染
@enduml
```

---

## 5) Component Diagram（组件图）

```plantuml
@startuml
skinparam componentStyle rectangle

component "MarkdownViewer" as Viewer
component "PlantUmlBlock" as Plant
component "MermaidBlock" as Mermaid
component "SvgBobBlock" as Bob
component "useApi" as Api
cloud "Kroki Service" as Kroki

Viewer --> Plant
Viewer --> Mermaid
Viewer --> Bob
Plant --> Kroki : POST /plantuml/svg
Viewer --> Api
@enduml
```

---

## 6) Deployment Diagram（部署图）

```puml
@startuml
node "Developer Mac" {
  artifact "markview binary"
  artifact "Markdown files"
}

node "Local Browser" {
  component "React App"
}

cloud "Kroki.io" {
  component "PlantUML Renderer"
}

"markview binary" --> "React App" : serve SPA + API
"React App" --> "PlantUML Renderer" : render request
"Markdown files" --> "markview binary" : watched files
@enduml
```

---

## 7) C4-Style（通过普通 PlantUML 语法模拟）

```plantuml
@startuml
rectangle "User" as U
rectangle "markview CLI" as CLI
rectangle "markview Server" as S
rectangle "Frontend (React)" as FE
rectangle "Kroki" as K

U --> CLI : run command
CLI --> S : start/add file
S --> FE : serve content
FE --> K : render plantuml
K --> FE : svg
@enduml
```

---

## 8) 故障回退检查（故意写错）

> 这个块故意语法错误，用于验证“渲染失败时回退到代码显示”。

```plantuml
@startuml
Alice -> Bob: missing enduml on purpose
```

---

## 验收建议

- 切换亮/暗主题，检查对比度是否可读。
- 点击全屏后测试：滚轮缩放、鼠标拖拽平移、重置。
- 检查失败块是否稳定回退而不影响其他图。
- 检查中文文本与箭头标签是否清晰。
