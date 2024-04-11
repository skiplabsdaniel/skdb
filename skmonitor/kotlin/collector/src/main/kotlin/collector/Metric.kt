package io.skiplabs.skmonitor

import com.fasterxml.jackson.databind.JsonNode
import io.opentelemetry.api.metrics.DoubleCounter
import io.opentelemetry.api.metrics.DoubleHistogram
import io.opentelemetry.api.metrics.LongCounter
import io.opentelemetry.api.metrics.LongHistogram
import io.opentelemetry.api.metrics.Meter
import io.opentelemetry.sdk.internal.AttributesMap
import io.opentelemetry.sdk.trace.SpanLimits
import io.opentelemetry.sdk.trace.convertAttributes
import java.util.logging.Level
import java.util.logging.Logger
import javax.script.Bindings
import javax.script.ScriptContext
import javax.script.ScriptEngine

const val METRICS_ATTRIBUTE_MODE = "attribute"
const val METRICS_COUNT_MODE = "count"
const val METRICS_DURATION_MODE = "duration"
const val METRICS_EVENT_MODE = "event"

const val METRICS_COUNTER_KIND = "counter"
const val METRICS_HISTOGRAL_KIND = "histogram"

const val DEFAULT_METRICS_NAME = "skmonitor.unknown"

data class Export(
    var name: String? = null,
    var asname: String? = null,
)

data class Metric(
    var name: String = DEFAULT_METRICS_NAME,
    var unit: String? = null,
    var description: String? = null,
    var mode: String = METRICS_ATTRIBUTE_MODE,
    var spans: Array<String> = arrayOf(),
    var key: String? = null,
    var kind: String = METRICS_COUNTER_KIND,
    var filter: Map<String, JsonNode> = HashMap(),
    var exports: Array<Export> = arrayOf(),
    var floatValue: Boolean = false,
    var condition: String? = null,
    var converter: String? = null,
) {
  fun withDefaultUnit(unit: String): Metric {
    if (this.unit == null) this.unit = unit
    return this
  }
}

class Values(
    val dHistogram: DoubleHistogram?,
    val dCounter: DoubleCounter?,
    val lHistogram: LongHistogram?,
    val lCounter: LongCounter?,
) {
  companion object {
    fun build(metric: Metric, meter: Meter): Values {
      return when (metric.kind) {
        METRICS_HISTOGRAL_KIND ->
            if (metric.floatValue) Values(buildDoubleHistogram(metric, meter), null, null, null)
            else Values(null, null, buildLongHistogram(metric, meter), null)
        else ->
            if (metric.floatValue) Values(null, buildDoubleCounter(metric, meter), null, null)
            else Values(null, null, null, buildLongCounter(metric, meter))
      }
    }
  }

  fun update(value: Value, attributes: () -> AttributesMap) {
    if (this.dHistogram != null || this.dCounter != null) {
      val double =
          when (value) {
            is VInt -> value.value.toDouble()
            is VFloat -> value.value
            else -> null
          }
      if (double != null) {
        if (this.dHistogram != null) this.dHistogram.record(double, attributes())
        if (this.dCounter != null) this.dCounter.add(double, attributes())
      }
    }
    if (this.lHistogram != null || this.lCounter != null) {
      val long =
          when (value) {
            is VInt -> value.value
            is VFloat -> value.value.toLong()
            else -> null
          }
      if (long != null) {
        if (this.lHistogram != null) this.lHistogram.record(long, attributes())
        if (this.lCounter != null) this.lCounter.add(long, attributes())
      }
    }
  }
}

abstract class MetricComputer(
    metric: Metric,
    meter: Meter,
    spanLimits: SpanLimits,
    engine: ScriptEngine
) : SpanManager {
  val metric = metric
  val collection = Values.build(metric, meter)
  val spanLimits = spanLimits
  val engine = engine
  val logger = Logger.getLogger(MetricComputer::class.java.getName())

  abstract fun value(span: Span): Value?

  override fun manage(span: Span) {
    if (!metric.spans.isEmpty() && metric.spans.filter { it.equals(span.name) }.isEmpty()) return
    val attrFilter = metric.filter.mapValues { toValue(it.value) }
    for (filter in attrFilter) {
      val value = span.attributes.get(filter.key)
      if (value == null || !value.equals(filter.value)) return
    }
    var value = value(span)
    if (value == null) return
    val condition = this.metric.condition
    if (condition != null) {
      try {
        val vars = engine.getBindings(ScriptContext.ENGINE_SCOPE)
        vars.put("value", value.toValue())
        fillBindings(span, vars)
        if (!(engine.eval(condition) as Boolean)) return
      } catch (e: Exception) {
        logger.log(Level.SEVERE, e.message)
        return
      }
    }
    val converter = this.metric.converter
    if (converter != null) {
      try {
        val vars = engine.getBindings(ScriptContext.ENGINE_SCOPE)
        vars.put("value", value.toValue())
        fillBindings(span, vars)
        val result = engine.eval(converter)
        value = if (metric.floatValue) VFloat(result as Double) else VInt(result as Long)
      } catch (e: Exception) {
        logger.log(Level.SEVERE, e.message)
        return
      }
    }
    this.collection.update(value) { buildAttributes(span, this.metric.exports, this.spanLimits) }
  }
}

fun fillBindings(span: Span, vars: Bindings) {
  vars.put("name", span.name)
  vars.put("status", span.status())
  vars.put("duration_ns", span.duration("ns"))
  vars.put("duration_µs", span.duration("µs"))
  vars.put("duration_ms", span.duration("ms"))
  vars.put("duration_s", span.duration("s"))
  vars.put("duration_m", span.duration("m"))
  vars.put("duration_h", span.duration("h"))
  vars.put("duration_d", span.duration("d"))
}

class AttributeMetric(metric: Metric, meter: Meter, spanLimits: SpanLimits, engine: ScriptEngine) :
    MetricComputer(metric, meter, spanLimits, engine) {

  override fun value(span: Span): Value? {
    val name = if (this.metric.key != null) this.metric.key!! else this.metric.name
    return span.attributes.get(name)
  }
}

class SpanMetric(metric: Metric, meter: Meter, spanLimits: SpanLimits, engine: ScriptEngine) :
    MetricComputer(metric, meter, spanLimits, engine) {

  override fun value(span: Span): Value? {
    return VInt(1)
  }
}

class EventMetric(metric: Metric, meter: Meter, spanLimits: SpanLimits, engine: ScriptEngine) :
    MetricComputer(metric, meter, spanLimits, engine) {

  override fun value(span: Span): Value? {
    var count = 0L
    for (event in span.events) {
      if (this.metric.key != null && !event.name.equals(this.metric.key)) continue
      count++
    }
    return VInt(count)
  }
}

class DurationMetric(metric: Metric, meter: Meter, spanLimits: SpanLimits, engine: ScriptEngine) :
    MetricComputer(metric, meter, spanLimits, engine) {

  override fun value(span: Span): Value? {
    return VFloat(span.duration(this.metric.unit!!))
  }
}

fun computeMetrics(
    meter: Meter,
    metrics: Array<Metric>,
    spanLimits: SpanLimits,
    managers: ArrayList<SpanManager>,
    engine: ScriptEngine
) {
  for (metric in metrics) {
    if (metric.name.equals(DEFAULT_METRICS_NAME)) continue
    when (metric.mode) {
      METRICS_ATTRIBUTE_MODE -> managers.add(AttributeMetric(metric, meter, spanLimits, engine))
      METRICS_COUNT_MODE -> managers.add(SpanMetric(metric, meter, spanLimits, engine))
      METRICS_DURATION_MODE -> managers.add(DurationMetric(metric, meter, spanLimits, engine))
      METRICS_EVENT_MODE -> managers.add(EventMetric(metric, meter, spanLimits, engine))
    }
  }
}

fun buildAttributes(span: Span, exports: Array<Export>, spanLimits: SpanLimits): AttributesMap {
  val skAttributes = HashMap<String, Value>()
  skAttributes.put("trace", VString(span.traceId))
  if (span.parentId != null) {
    skAttributes.put("parent", VString(span.parentId))
  }
  for (e in exports) {
    if (e.name == null) continue
    val attr = span.attributes.get(e.name)
    if (attr == null) continue
    skAttributes.put(if (e.asname == null) e.name!! else e.asname!!, attr)
  }
  return convertAttributes(
      skAttributes,
      spanLimits.maxNumberOfAttributes,
      spanLimits.maxAttributeValueLength
  )
}
