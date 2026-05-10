package server

import (
	"sync"
	"time"
)

type counter struct {
	duration    time.Duration
	zeroTimer   *time.Timer
	wg          sync.WaitGroup
	connections int
	mutex       sync.Mutex
}

func newCounter(duration time.Duration) *counter {
	zeroTimer := time.NewTimer(duration)

	// when duration is 0, stop the timer and drain the channel so
	// it never fires and the goroutine in Run() won't spuriously cancel.
	if duration == 0 {
		if !zeroTimer.Stop() {
			<-zeroTimer.C
		}
	}

	return &counter{
		duration:  duration,
		zeroTimer: zeroTimer,
	}
}

func (counter *counter) add(n int) int {
	counter.mutex.Lock()
	defer counter.mutex.Unlock()

	if counter.duration > 0 {
		counter.zeroTimer.Stop()
	}
	counter.wg.Add(n)
	counter.connections += n

	return counter.connections
}

func (counter *counter) done() int {
	counter.mutex.Lock()
	defer counter.mutex.Unlock()

	counter.connections--
	counter.wg.Done()
	if counter.connections == 0 && counter.duration > 0 {
		counter.zeroTimer.Reset(counter.duration)
	}

	return counter.connections
}

func (counter *counter) count() int {
	counter.mutex.Lock()
	defer counter.mutex.Unlock()

	return counter.connections
}

func (counter *counter) wait() {
	counter.wg.Wait()
}

func (counter *counter) timer() *time.Timer {
	return counter.zeroTimer
}
