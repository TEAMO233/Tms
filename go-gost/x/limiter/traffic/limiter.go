package traffic

import (
	"context"
	"fmt"
	"sort"
	"strconv"

	limiter "github.com/go-gost/core/limiter/traffic"
	"golang.org/x/time/rate"
)

type llimiter struct {
	limiter *rate.Limiter
}

// 突发额度(令牌桶容量)。原来是 rate 本身,等于白送 1 秒的量:
// 客户端做几秒的短时测速时,这一秒会被平摊进平均值,测出来比设定值高一大截
// (设 5MB/s 能测出 10MB/s 以上),用户会以为限速没生效。
// 收紧到 1/5 秒,短时测速也能贴近设定值;同时不低于 64KB,
// 否则单次读写(常见 32KB 缓冲)会被切得太碎、拖垮吞吐。
const (
	burstDivisor = 5
	minBurst     = 64 * 1024
)

func burstOf(r int) int {
	b := r / burstDivisor
	if b < minBurst {
		b = minBurst
	}
	if b > r {
		b = r // 限速本身就很小时,桶不能比速率还大
	}
	return b
}

func NewLimiter(r int) limiter.Limiter {
	return &llimiter{
		limiter: rate.NewLimiter(rate.Limit(r), burstOf(r)),
	}
}

func (l *llimiter) Wait(ctx context.Context, n int) int {
	if l.limiter.Burst() < n {
		n = l.limiter.Burst()
	}
	l.limiter.WaitN(ctx, n)
	return n
}

func (l *llimiter) Limit() int {
	return int(l.limiter.Limit())
}

func (l *llimiter) Set(n int) {
	l.limiter.SetLimit(rate.Limit(n))
	l.limiter.SetBurst(burstOf(n))
}

func (l *llimiter) String() string {
	return strconv.Itoa(int(l.limiter.Limit()))
}

type limiterGroup struct {
	limiters []limiter.Limiter
}

func newLimiterGroup(limiters ...limiter.Limiter) *limiterGroup {
	sort.Slice(limiters, func(i, j int) bool {
		return limiters[i].Limit() < limiters[j].Limit()
	})
	return &limiterGroup{limiters: limiters}
}

func (l *limiterGroup) Wait(ctx context.Context, n int) int {
	for i := range l.limiters {
		if v := l.limiters[i].Wait(ctx, n); v < n {
			n = v
		}
	}
	return n
}

func (l *limiterGroup) Limit() int {
	if len(l.limiters) == 0 {
		return 0
	}

	return l.limiters[0].Limit()
}

func (l *limiterGroup) Set(n int) {}

func (l *limiterGroup) String() string {
	return fmt.Sprintf("%v", l.limiters)
}
