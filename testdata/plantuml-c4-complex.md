# PlantUML C4 Complex (Nested)

用于检查 PlantUML 在复杂 C4（多层嵌套）下的渲染、布局与交互（全屏/缩放/平移）。

```plantuml
@startuml
!includeurl https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Component.puml

LAYOUT_WITH_LEGEND()

title Media Cloud Platform - Complex Nested C4

Person(user, "终端用户", "观看直播/回放，管理个人内容")
Person(ops, "运营人员", "管理频道、活动、内容审核")
Person(devops, "平台运维", "监控、发布、应急处理")

System_Ext(cdn, "CDN", "边缘分发网络")
System_Ext(payment, "支付网关", "第三方支付/退款")
System_Ext(idp, "企业统一身份平台", "OIDC/SAML")

System_Boundary(ent, "XX 集团数字媒体事业群") {
  System_Boundary(platform, "Media Cloud Platform") {

    Container_Boundary(access_domain, "接入与体验域") {
      Container(web_portal, "Web Portal", "React + Vite", "面向用户和运营的统一门户")
      Container(api_gateway, "API Gateway", "Kong / Envoy", "统一鉴权、路由、限流、灰度")
      Container(bff, "BFF", "Go", "聚合接口，面向前端裁剪数据")
      Component(auth_adapter, "Auth Adapter", "Go Module", "对接统一身份平台，处理 Token 交换")
      Component(feature_flag, "Feature Flag SDK", "OpenFeature", "按租户/用户启用功能")
    }

    Container_Boundary(live_domain, "实时直播域") {
      Container(live_control, "Live Control Plane", "Go", "直播任务编排、流状态管理")
      Container(live_media, "Live Media Plane", "Rust/Go", "转码、混流、截图、录制")
      Container(ws_push, "Realtime Push", "NATS + WebSocket", "向前端推送实时事件")
      Component(stream_scheduler, "Stream Scheduler", "Component", "根据资源水位调度任务")
      Component(recording_orchestrator, "Recording Orchestrator", "Component", "直播录制生命周期管理")
      Component(scene_composer, "Scene Composer", "Component", "多机位/字幕/贴片场景合成")
    }

    Container_Boundary(vod_domain, "点播与检索域") {
      Container(vod_service, "VOD Service", "Go", "回放、剪辑、转码任务管理")
      Container(search_service, "Search Service", "Elasticsearch + Go", "视频/字幕全文检索")
      Container(metadata_service, "Metadata Service", "Go", "媒体元数据、标签、分类")
      Component(clip_engine, "Clip Engine", "FFmpeg Worker", "片段裁剪与拼接")
      Component(index_pipeline, "Index Pipeline", "Kafka Consumer", "字幕与描述索引构建")
      Component(thumbnailer, "Thumbnailer", "Worker", "缩略图与预览雪碧图生成")
    }

    Container_Boundary(biz_domain, "计费与权限域") {
      Container(tenant_service, "Tenant Service", "Go", "租户、组织、成员与配额")
      Container(rbac_service, "RBAC Service", "Go", "角色、策略、资源权限")
      Container(billing_service, "Billing Service", "Go", "计费、账单、对账")
      Component(quota_guard, "Quota Guard", "Policy Component", "配额校验与超限保护")
      Component(invoice_worker, "Invoice Worker", "Batch Job", "账单汇总、开票数据生成")
    }

    Container_Boundary(data_domain, "数据与可观测域") {
      ContainerDb(meta_db, "Meta DB", "PostgreSQL", "业务主数据")
      ContainerDb(cache, "Redis Cluster", "Redis", "热点缓存/会话/短 TTL 数据")
      ContainerDb(obj, "Object Storage", "S3 Compatible", "媒体文件、切片、截图")
      Container(event_bus, "Event Bus", "Kafka", "领域事件与异步任务")
      Container(obs_stack, "Observability Stack", "Prometheus + Loki + Tempo", "指标/日志/链路")
      Component(audit_log, "Audit Logger", "Component", "审计事件归档与检索")
      Component(anomaly_detector, "Anomaly Detector", "ML Job", "异常流量/质量检测")
    }
  }
}

Rel(user, web_portal, "访问", "HTTPS")
Rel(ops, web_portal, "运营管理", "HTTPS")
Rel(devops, obs_stack, "查看监控与告警", "UI")

Rel(web_portal, bff, "调用聚合接口", "HTTPS/JSON")
Rel(bff, api_gateway, "经由网关访问内部服务", "mTLS")
Rel(api_gateway, auth_adapter, "鉴权委托", "gRPC")
Rel(auth_adapter, idp, "Token 校验/交换", "OIDC")

Rel(bff, live_control, "开播/停播/状态查询", "gRPC")
Rel(bff, vod_service, "回放/剪辑任务", "gRPC")
Rel(bff, search_service, "搜索建议与结果", "HTTPS")
Rel(bff, tenant_service, "租户上下文", "gRPC")
Rel(bff, rbac_service, "权限判定", "gRPC")

Rel(live_control, stream_scheduler, "调度策略计算")
Rel(stream_scheduler, live_media, "下发转码/混流任务", "NATS")
Rel(live_media, scene_composer, "场景合成调用")
Rel(live_control, recording_orchestrator, "录制编排")
Rel(recording_orchestrator, obj, "写入录制文件", "S3 API")
Rel(live_control, ws_push, "推送状态事件")
Rel(ws_push, web_portal, "实时事件", "WebSocket")
Rel(live_media, cdn, "推流/分发", "RTMP/HLS")

Rel(vod_service, clip_engine, "发起剪辑任务")
Rel(vod_service, thumbnailer, "生成预览图")
Rel(vod_service, metadata_service, "写入/读取元数据")
Rel(metadata_service, meta_db, "读写")
Rel(search_service, index_pipeline, "索引任务")
Rel(index_pipeline, event_bus, "消费媒体事件")
Rel(index_pipeline, search_service, "更新索引")

Rel(tenant_service, quota_guard, "配额校验")
Rel(billing_service, invoice_worker, "账单批处理")
Rel(billing_service, payment, "支付/退款", "HTTPS")
Rel(rbac_service, meta_db, "策略持久化")
Rel(tenant_service, meta_db, "租户数据持久化")

Rel(api_gateway, cache, "限流计数/会话缓存")
Rel(live_control, event_bus, "发布直播事件")
Rel(vod_service, event_bus, "发布点播事件")
Rel(audit_log, meta_db, "审计落库")
Rel(anomaly_detector, obs_stack, "读取指标与日志")
Rel(anomaly_detector, event_bus, "发布异常事件")

SHOW_LEGEND()
@enduml
```
