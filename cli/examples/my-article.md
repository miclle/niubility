---
title: Go 并发模式实践
summary: 介绍常见的 Go 并发模式，包括 worker pool、pipeline、fan-out/fan-in 等
category: learning
tags: [go, 并发, 并发模式]
status: draft
---

# Go 并发模式实践

Go 语言的并发模型是其核心特性之一。本文将介绍几种常见的并发模式。

## Worker Pool

Worker Pool 是最常见的并发模式之一，适用于需要处理大量独立任务的场景。

```go
func worker(id int, jobs <-chan int, results chan<- int) {
    for j := range jobs {
        results <- j * 2
    }
}

func main() {
    jobs := make(chan int, 100)
    results := make(chan int, 100)

    // 启动 3 个 worker
    for w := 1; w <= 3; w++ {
        go worker(w, jobs, results)
    }

    // 发送任务
    for j := 1; j <= 5; j++ {
        jobs <- j
    }
    close(jobs)

    // 收集结果
    for a := 1; a <= 5; a++ {
        <-results
    }
}
```

## Pipeline

Pipeline 模式将复杂处理分解为多个阶段，每个阶段通过 channel 连接。

## Fan-out/Fan-in

Fan-out 启动多个 goroutine 处理同一个输入 channel，Fan-in 将多个 channel 的结果合并到一个输出 channel。

## 总结

合理使用并发模式可以显著提升程序性能，但也要注意避免过度并发带来的复杂性。
