# PlantUML demo

```plantuml
@startuml
actor User
participant "markview" as MARKVIEW
participant Kroki

User -> MARKVIEW: open Markdown file
MARKVIEW -> Kroki: POST PlantUML text
Kroki --> MARKVIEW: SVG
MARKVIEW --> User: render diagram
@enduml
```

```puml
@startuml
skinparam monochrome true
start
:Parse markdown;
if (Code fence == plantuml?) then (yes)
  :Render via Kroki;
  :Show SVG image;
else (no)
  :Use normal code highlighter;
endif
stop
@enduml
```
