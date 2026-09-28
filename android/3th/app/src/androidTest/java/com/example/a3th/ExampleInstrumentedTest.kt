package com.example.a3th

import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.ext.junit.runners.AndroidJUnit4

import org.junit.Test
import org.junit.runner.RunWith

import org.junit.Assert.*
import kotlin.rem

/**
 * Instrumented test, which will execute on an Android device.
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
@RunWith(AndroidJUnit4::class)
class ExampleInstrumentedTest {
    @Test
    fun useAppContext() {
        // Context of the app under test.
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("com.example.a3th", appContext.packageName)

        var myX: Int = 100
        var myY: Float = myX.toFloat()
        Log.d("자료형 변환 ","Int : " + myX)
        Log.d("자료형 변환 ","Float : " + myY)

        var x: Int = 5
        var y: Int = 2

        Log.d("산술 연산자 ", "x + y = " + (x+y))
        Log.d("산술 연산자 ", "x - y = " + (x-y))
        Log.d("산술 연산자 ", "x * y = " + (x*y))
        Log.d("산술 연산자 ", "x / y = " + (x/y))
        Log.d("산술 연산자 ", "x % y = " + (x%y))

        Log.d("비교 연산자 ", "x > y = " + (x>y))
        Log.d("비교 연산자 ", "x < y = " + (x<y))
        Log.d("비교 연산자 ", "x >= y = " + (x>=y))
        Log.d("비교 연산자 ", "x <= y = " + (x<=y))
        Log.d("비교 연산자 ", "x == y = " + (x==y))
        Log.d("비교 연산자 ", "x != y = " + (x!=y))

        x = 5
        y = 10
        y += x
        Log.d("할당 연산자 ", "y += x => y =" + y)
        y -= x
        Log.d("할당 연산자 ", "y -= x => y =" + y)
        y *= x
        Log.d("할당 연산자 ", "y *= x => y =" + y)
        y /= x
        Log.d("할당 연산자 ", "y /= x => y =" + y)
        y %= x
        Log.d("할당 연산자 ", "y %= x => y =" + y)

        var num: Int = 10
        if(num % 2 == 0) {
            Log.d("if-else 조건문 ","숫자 "+ num + "은 짝수")
        }else {
            Log.d("if-else 조건문 ","숫자 "+ num + "은 홀수")
        }

        num = -10
        var result: String
        if (num > 0) {
            result = "숫자 " + num + "은 양수"
        }else if (num == 0){
            result = "숫자 " + num + "은 0"
        }else {
            result = "숫자 " + num + "은 음수"
        }
        Log.d("if-else if 조건문 ", result)


        var num2: Int = -10
        var result2: String
        if(num2>0) {
            if(num2 % 2 == 0){
                result2 = "숫자 " + num2 + "은 양수이고 짝수"
            }else {
                result2 = "숫자 " + num2 + "은 양수이고 홀수"
                }
            }else {
            if(num2 % 2 == 0){
                result2 = "숫자 " + num2 + "은 음수이고 짝수"
            }else {
                result2 = "숫자 " + num2 + "은 음수이고 홀수"
            }
        }
        Log.d("중첩 if 조건문 ", result2)

        var day : Int = 2
        var result3 : String
        when (day) {
            1 -> result3 = "Monday"
            2 -> result3 = "Tuesday"
            3 -> result3 = "Wednesday"
            4 -> result3 = "Thursday"
            5 -> result3 = "Friday"
            6 -> result3 = "Saturday"
            7 -> result3 = "Sunday"
            else -> result3 = "Invalid day"
        }
        Log.d("When 조건문 ", result3)

        for (i in 5 downTo 1 ) {
            Log.d("for 반복문 ", "반복 변수 :" + i)
        }
        for (i in 5 downTo 1 step 2) {
            Log.d("for 반복문", "반복 변수 : " + i)
        }
        var numbers = arrayOf(1,2,3,4,5)
        for (i in numbers) {
            if (i % 2 ==1 ){
                Log.d("for 반복문 ", "반복 변수 : " + i )
            }
        }

        var score: Int = 70
        var attendanceRate : Int = 80

        if(attendanceRate >=80){
            if(score >= 90) {
                println("A학점")
            }else if(score >= 80){
                println("B학점")
            }else if(score >= 70){
                println("C학점")
            }else {
                println("F학점")
            }
        }else{
            println("F학점")
        }


        var i : Int

        for(i in 9 downTo 1){
            println("구구단 ${10-i}단")
            for(j in 9 downTo 1){
                println("${10-i} * ${10-j} = ${(10-i)*(10-j)}")
            }
        }

        for(i in 10..13){
            for (j in 5..10){  // 2단부터 9단까지만 먼저 가로로 출력
                print("$i x $j = ${i * j} \t")
            }
            println() // 줄바꿈
        }

    }
    }