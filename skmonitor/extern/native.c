#include <ctype.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

void* SKIP_SKMonitor_createTime(__uint64_t s, __uint64_t ns);
void sk_global_lock();
void sk_global_unlock();
void sk_string_check_c_safe(char* str);

void* SKIP_SKMonitor_now() {
  struct timespec now;
  timespec_get(&now, TIME_UTC);
  return SKIP_SKMonitor_createTime(now.tv_sec, now.tv_nsec);
}

__uint8_t SKIP_SKMonitor_checkFifo(char* fifo) {
  sk_string_check_c_safe(fifo);
  if (access(fifo, F_OK) == 0) {
    return 1;
  }
  return 0;
}

__uint32_t SKIP_global_has_lock();

__uint8_t SKIP_SKMonitor_appendToFifo(char* fifo, char* trace) {
  sk_string_check_c_safe(trace);
  sk_string_check_c_safe(fifo);
  int fifo_write = open(fifo, O_WRONLY | O_APPEND | O_NONBLOCK);
  if (fifo_write < 0) {
    return 0;
  }
  char* b = trace;
  const char* s;
  for (s = trace; *s; ++s)
    ;
  size_t n = (s - trace);
  size_t r = 0;
  int has_lock = SKIP_global_has_lock();
  if (!has_lock) {
    sk_global_lock();
  }
  while (r < n) {
    b += r;
    n -= r;
    r = write(fifo_write, b, n);
    if (r < 0) {
      if (!has_lock) {
        sk_global_unlock();
      }
      return 0;
    }
  }
  if (!has_lock) {
    sk_global_unlock();
  }
  return 1;
}
